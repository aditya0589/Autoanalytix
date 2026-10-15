import json
import re
from typing import Dict, Any, List, Optional
from langgraph.graph import StateGraph, END
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.language_models.chat_models import BaseChatModel

from app.ai.schemas.state import AnalyticsState
from app.analytics.sql_validator import SQLValidator, SQLSecurityValidationError
from app.analytics.engine import analytics_engine

SYSTEM_PLANNER_PROMPT = """You are an expert analytical planner and SQL engineer for DuckDB.
Your task is to analyze the user's question, inspect the dataset schema and profile, and produce a structured analysis plan and DuckDB SQL query.

TABLE NAME TO QUERY: {table_name}
SCHEMA COLUMNS AND TYPES:
{columns_info}

SAMPLE METRIC STATS:
{sample_stats}

CONVERSATION HISTORY (if follow-up):
{history}

RULES:
1. ONLY query the table `{table_name}`. Do NOT query any other table.
2. Generate strictly read-only DuckDB SQL (SELECT only).
3. Always choose appropriate aggregations (SUM, AVG, COUNT, MIN, MAX).
4. If the question involves monthly/quarterly trends and there's a date column, use DuckDB date functions like `strftime(order_date, '%Y-%m') AS month` or `date_trunc('month', order_date)`.
5. If the user question is completely ambiguous or references columns that clearly do not exist, specify `clarification_question` and 2-4 `clarification_options`.
6. Select an appropriate chart type: 'kpi', 'bar', 'horizontal_bar', 'line', 'area', 'pie', 'donut', 'scatter', or 'table'.
7. For KPI cards, calculate a single aggregated value (e.g., total revenue, average order value).

Respond ONLY with a valid JSON object matching this schema:
{{
  "intent": "time_series | ranking | aggregation | breakdown | comparison",
  "chart_type": "kpi | bar | horizontal_bar | line | area | pie | donut | scatter | table",
  "title": "Clear descriptive chart title",
  "x_axis": "column_name_for_x or null",
  "y_axis": "column_name_for_y or null",
  "sql": "SELECT ... FROM {table_name} ...",
  "clarification_question": null or "Question if ambiguous",
  "clarification_options": [] or ["Option 1", "Option 2"]
}}
"""

INSIGHTS_PROMPT = """You are a senior business intelligence consultant explaining data to a non-technical business executive.
Ground your explanation and findings strictly in the actual query results, schema, and statistics provided below.
Do NOT invent numbers, percentages, or facts that are not present in the data.

USER QUESTION: {question}
DATASET SCHEMA & CONTEXT:
{schema_summary}
EXECUTED SQL: {sql}
QUERY RESULTS (First 15 rows):
{results_json}

Provide:
1. "explanation": A warm, lucid, and thorough narrative explanation (2 to 3 paragraphs) written in clear, plain business English.
   - If the user asked "describe my data", "what is this dataset", or similar, explain what business operations or activity this data tracks (e.g. sales orders, customers, regions, products), total scale/volume, key dimensions, and primary metrics available.
   - Avoid technical jargon, SQL keywords, or raw database syntax.
   - Focus on what the numbers mean for business decision-makers.
2. "insights": 2 to 4 concise bullet points highlighting key numbers, top drivers, or notable comparisons.

Respond ONLY with a valid JSON object matching this schema:
{{
  "explanation": "Plain-language business narrative explanation...",
  "insights": [
    "Observed: Total revenue reached $1,420,500 across 1,200 orders.",
    "Calculated: Enterprise segment generated the highest revenue share at 48.2%."
  ]
}}
"""

def extract_json(text: str) -> Any:
    """Robustly extracts JSON from LLM markdown code blocks or raw strings with multi-layer fault tolerance."""
    if not text:
        return {}
        
    text = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        text = match.group(1).strip()
    
    # 1. Direct parse with strict=False (allows unescaped control characters/newlines inside string literals)
    try:
        return json.loads(text, strict=False)
    except Exception:
        pass
        
    # 2. Extract outermost { ... }
    first_brace = text.find('{')
    last_brace = text.rfind('}')
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        candidate = text[first_brace:last_brace+1]
        try:
            return json.loads(candidate, strict=False)
        except Exception:
            # Clean trailing commas before closing braces/brackets
            cleaned = re.sub(r',\s*([\}\]])', r'\1', candidate)
            try:
                return json.loads(cleaned, strict=False)
            except Exception:
                pass

    # 3. Fallback heuristic regex extraction if model produced badly formed JSON
    sql_match = re.search(r'["\']?sql["\']?\s*:\s*["\']([^"\']+)["\']', text, re.IGNORECASE)
    if not sql_match:
        sql_match = re.search(r'SELECT\s+[\s\S]+?(?=;|\n\n|"|\}|$)', text, re.IGNORECASE)
    
    explanation_match = re.search(r'["\']?explanation["\']?\s*:\s*["\']([^"\']+)["\']', text, re.IGNORECASE)
    rationale_match = re.search(r'["\']?rationale["\']?\s*:\s*["\']([^"\']+)["\']', text, re.IGNORECASE)
    
    if sql_match:
        sql_val = sql_match.group(1) if sql_match.groups() else sql_match.group(0)
        return {
            "sql": sql_val.strip(),
            "rationale": (rationale_match.group(1) if rationale_match else "Analysis computed from dataset."),
            "explanation": (explanation_match.group(1) if explanation_match else "Analysis computed from dataset."),
            "chart_type": "bar"
        }
    
    return json.loads(text, strict=False)

class AnalyticsWorkflow:
    def __init__(self, llm: Optional[BaseChatModel] = None):
        self.llm = llm

    def build_graph(self):
        workflow = StateGraph(AnalyticsState)

        workflow.add_node("plan_and_generate_sql", self.plan_node)
        workflow.add_node("validate_sql", self.validate_sql_node)
        workflow.add_node("execute_query", self.execute_query_node)
        workflow.add_node("generate_chart_and_insights", self.insights_node)

        workflow.set_entry_point("plan_and_generate_sql")

        workflow.add_conditional_edges(
            "plan_and_generate_sql",
            self.route_after_planning,
            {
                "clarification": END,
                "validate_sql": "validate_sql",
                "failed": END
            }
        )

        workflow.add_conditional_edges(
            "validate_sql",
            self.route_after_validation,
            {
                "execute": "execute_query",
                "retry": "plan_and_generate_sql",
                "failed": END
            }
        )

        workflow.add_edge("execute_query", "generate_chart_and_insights")
        workflow.add_edge("generate_chart_and_insights", END)

        return workflow.compile()

    def plan_node(self, state: AnalyticsState) -> Dict[str, Any]:
        columns_info = "\n".join([
            f"- {c.get('name')}: {c.get('data_type')} ({c.get('duckdb_type', '')})"
            for c in state.get("dataset_schema", [])
        ])
        
        sample_stats = json.dumps(
            {c.get("name"): c.get("stats", {}) for c in state.get("dataset_schema", []) if c.get("stats")},
            indent=2
        )[:1500]

        history_str = "\n".join([
            f"{m.get('role')}: {m.get('content')}"
            for m in state.get("conversation_history", [])[-4:]
        ])

        system_msg = SYSTEM_PLANNER_PROMPT.format(
            table_name=state["dataset_table_name"],
            columns_info=columns_info,
            sample_stats=sample_stats,
            history=history_str or "No previous context."
        )

        question = state["user_question"]
        if state.get("sql_retry_count", 0) > 0 and state.get("error"):
            question += f"\n\nPREVIOUS ATTEMPT FAILED WITH ERROR: {state['error']}. Please fix the SQL query accordingly."

        # If LLM is available, use it
        if self.llm:
            try:
                response = self.llm.invoke([
                    SystemMessage(content=system_msg),
                    HumanMessage(content=question)
                ])
                parsed = extract_json(response.content)
            except Exception as e:
                return {
                    "error": f"Failed to generate analysis plan from AI provider: {str(e)}",
                    "status": "failed"
                }
        else:
            # Fallback heuristic planner for automated tests or when LLM is mocked
            parsed = self._heuristic_planner(state)

        # Check for clarification request
        if parsed.get("clarification_question"):
            return {
                "clarification_question": parsed.get("clarification_question"),
                "clarification_options": parsed.get("clarification_options", []),
                "status": "clarification"
            }

        return {
            "analysis_plan": parsed,
            "generated_sql": parsed.get("sql"),
            "status": "planning"
        }

    def validate_sql_node(self, state: AnalyticsState) -> Dict[str, Any]:
        sql = state.get("generated_sql")
        table_name = state["dataset_table_name"]

        if not sql:
            return {
                "error": "No SQL query was produced.",
                "status": "failed"
            }

        try:
            sanitized = SQLValidator.validate_and_sanitize(sql, table_name)
            return {
                "generated_sql": sanitized,
                "status": "validated",
                "error": None
            }
        except SQLSecurityValidationError as e:
            retry_count = state.get("sql_retry_count", 0) + 1
            if retry_count <= 2:
                return {
                    "error": str(e),
                    "sql_retry_count": retry_count,
                    "status": "retry"
                }
            return {
                "error": f"SQL security validation failed: {str(e)}",
                "status": "failed"
            }

    def execute_query_node(self, state: AnalyticsState) -> Dict[str, Any]:
        sql = state.get("generated_sql")
        table_name = state["dataset_table_name"]
        
        try:
            result = analytics_engine.execute_query(sql, table_name)
            return {
                "query_result": result,
                "status": "executed"
            }
        except Exception as e:
            return {
                "error": f"DuckDB execution error: {str(e)}",
                "status": "failed"
            }

    def insights_node(self, state: AnalyticsState) -> Dict[str, Any]:
        plan = state.get("analysis_plan", {})
        result = state.get("query_result", {})
        rows = result.get("rows", [])
        cols = result.get("columns", [])

        # Construct Chart Specification
        chart_type = plan.get("chart_type", "bar")
        title = plan.get("title", f"Analysis: {state['user_question']}")
        
        x_axis_raw = plan.get("x_axis")
        y_axis_raw = plan.get("y_axis")

        def match_col(target: Optional[str], default_col: Optional[str]) -> Optional[str]:
            if not target:
                return default_col
            if target in cols:
                return target
            clean_target = re.sub(r"[\s_-]+", "", target.lower())
            for c in cols:
                clean_c = re.sub(r"[\s_-]+", "", c.lower())
                if clean_c == clean_target or clean_target in clean_c or clean_c in clean_target:
                    return c
            return default_col

        x_axis = match_col(x_axis_raw, cols[0] if cols else None)
        y_axis = match_col(y_axis_raw, cols[1] if len(cols) > 1 else (cols[0] if cols else None))

        kpi_val = None
        kpi_sub = None
        if chart_type == "kpi" and rows:
            first_val = list(rows[0].values())[0] if rows[0] else None
            kpi_val = first_val
            kpi_sub = f"Total across {len(rows)} records" if len(rows) > 1 else "Aggregated metric"

        chart_spec = {
            "type": chart_type,
            "title": title,
            "x_axis": x_axis,
            "y_axis": y_axis,
            "kpi_value": kpi_val,
            "kpi_subtext": kpi_sub,
            "data": rows[:100]  # Cap at 100 points for crisp frontend rendering
        }

        # Generate Grounded Explanation and Insights
        insights: List[str] = []
        explanation: Optional[str] = None

        schema_summary = "\n".join([
            f"- {c.get('name')}: {c.get('data_type')} ({c.get('duckdb_type', '')})"
            for c in state.get("dataset_schema", [])
        ])

        if self.llm and (rows or "describe" in state["user_question"].lower()):
            try:
                prompt = INSIGHTS_PROMPT.format(
                    question=state["user_question"],
                    schema_summary=schema_summary,
                    sql=state.get("generated_sql") or "N/A",
                    results_json=json.dumps(rows[:15], indent=2)
                )
                res = self.llm.invoke([HumanMessage(content=prompt)])
                parsed_res = extract_json(res.content)
                if isinstance(parsed_res, dict):
                    explanation = parsed_res.get("explanation")
                    raw_ins = parsed_res.get("insights", [])
                    if isinstance(raw_ins, list):
                        insights = [str(i) for i in raw_ins]
                elif isinstance(parsed_res, list):
                    insights = [str(i) for i in parsed_res]
            except Exception:
                pass

        if not explanation:
            explanation = self._deterministic_explanation(state, rows, cols)

        if not insights:
            insights = self._deterministic_insights(rows, cols, state["user_question"])

        return {
            "chart_specification": chart_spec,
            "insights": insights,
            "explanation": explanation,
            "status": "complete"
        }

    def route_after_planning(self, state: AnalyticsState) -> str:
        if state.get("status") == "clarification":
            return "clarification"
        if state.get("status") == "failed":
            return "failed"
        return "validate_sql"

    def route_after_validation(self, state: AnalyticsState) -> str:
        if state.get("status") == "retry":
            return "retry"
        if state.get("status") == "failed":
            return "failed"
        return "execute"

    def _heuristic_planner(self, state: AnalyticsState) -> Dict[str, Any]:
        """Deterministic analytical planner used when testing or as fallback."""
        table = state["dataset_table_name"]
        schema = state.get("dataset_schema", [])
        q = state["user_question"].lower()

        num_cols = [c["name"] for c in schema if c.get("data_type") == "numeric"]
        cat_cols = [c["name"] for c in schema if c.get("data_type") == "categorical"]
        date_cols = [c["name"] for c in schema if c.get("data_type") == "datetime"]

        # 1. Total / KPI question
        if any(w in q for w in ["total", "kpi", "overall", "how much", "average"]):
            target_metric = num_cols[0] if num_cols else "count(*)"
            agg = "AVG" if "average" in q else "SUM"
            return {
                "intent": "kpi",
                "chart_type": "kpi",
                "title": f"{agg} of {target_metric.replace('_', ' ').title()}",
                "sql": f"SELECT round({agg}({target_metric}), 2) AS total_{target_metric} FROM {table}",
                "clarification_question": None
            }

        # 2. Monthly / Time series question
        if date_cols and num_cols and any(w in q for w in ["month", "trend", "over time", "time", "quarter", "growth", "year", "2026", "2025"]):
            d_col = date_cols[0]
            m_col = num_cols[0]
            where_clause = ""
            if "2026" in q:
                where_clause = f" WHERE {d_col} LIKE '2026%'"
            elif "2025" in q:
                where_clause = f" WHERE {d_col} LIKE '2025%'"
            return {
                "intent": "time_series",
                "chart_type": "line",
                "title": f"Monthly {m_col.replace('_', ' ').title()} Trend",
                "x_axis": "month",
                "y_axis": f"total_{m_col}",
                "sql": f"SELECT substr(cast({d_col} as varchar), 1, 7) AS month, round(sum({m_col}), 2) AS total_{m_col} FROM {table}{where_clause} GROUP BY 1 ORDER BY 1",
                "clarification_question": None
            }

        # 3. Categorical breakdown
        if cat_cols and num_cols:
            dim = cat_cols[0]
            metric = num_cols[0]
            # Try to match dimension mentioned in question
            for c in cat_cols:
                if c.replace("_", " ") in q or c in q:
                    dim = c
                    break
            for m in num_cols:
                if m.replace("_", " ") in q or m in q:
                    metric = m
                    break

            limit = 5 if "top 5" in q else 10
            return {
                "intent": "ranking",
                "chart_type": "bar",
                "title": f"{metric.replace('_', ' ').title()} by {dim.replace('_', ' ').title()}",
                "x_axis": dim,
                "y_axis": f"total_{metric}",
                "sql": f"SELECT {dim}, round(sum({metric}), 2) AS total_{metric} FROM {table} GROUP BY {dim} ORDER BY total_{metric} DESC LIMIT {limit}",
                "clarification_question": None
            }

        # 4. Describe / Overview question
        if any(w in q for w in ["describe", "overview", "what is this", "tell me about", "explain data", "summary"]):
            target_metric = num_cols[0] if num_cols else "*"
            return {
                "intent": "dataset_overview",
                "chart_type": "table",
                "title": "Dataset Overview & Sample Records",
                "sql": f"SELECT * FROM {table} LIMIT 8",
                "clarification_question": None
            }

        # Generic fallback
        return {
            "intent": "table_overview",
            "chart_type": "table",
            "title": "Dataset Sample",
            "sql": f"SELECT * FROM {table} LIMIT 10",
            "clarification_question": None
        }

    def _deterministic_explanation(self, state: AnalyticsState, rows: List[Dict[str, Any]], cols: List[str]) -> str:
        q = state["user_question"].lower()
        schema = state.get("dataset_schema", [])
        profile = state.get("dataset_profile", {})
        total_rows = profile.get("row_count") or len(rows)

        cat_cols = [c["name"].replace("_", " ").title() for c in schema if c.get("data_type") == "categorical"]
        num_cols = [c["name"].replace("_", " ").title() for c in schema if c.get("data_type") == "numeric"]
        date_cols = [c["name"].replace("_", " ").title() for c in schema if c.get("data_type") == "datetime"]

        if any(w in q for w in ["describe", "overview", "what is this", "explain", "tell me about"]):
            parts = [
                f"This dataset contains **{total_rows:,} recorded business transactions/entries** across **{len(schema)} distinct attributes**."
            ]
            if num_cols:
                parts.append(
                    f"**Key Metrics:** Quantitative tracking is available for **{', '.join(num_cols[:4])}**"
                    + (f" and {len(num_cols) - 4} other metrics." if len(num_cols) > 4 else ".")
                )
            if cat_cols:
                parts.append(
                    f"**Key Categories & Dimensions:** You can slice, segment, and compare performance across **{', '.join(cat_cols[:5])}**."
                )
            if date_cols:
                parts.append(
                    f"**Time Horizon:** Chronological tracking is enabled via the **{', '.join(date_cols)}** timeline."
                )
            return "\n\n".join(parts)

        # Standard analytical query explanation
        if rows:
            if len(rows) == 1:
                first_k, first_v = list(rows[0].items())[0] if rows[0] else ("metric", 0)
                formatted_v = f"${first_v:,.2f}" if isinstance(first_v, (int, float)) and first_v > 100 else f"{first_v}"
                return (
                    f"Based on your query regarding **{state['user_question']}**, we aggregated the matching records across the dataset. "
                    f"The computed **{first_k.replace('_', ' ')}** is **{formatted_v}**."
                )
            return (
                f"Here is the breakdown for **{state['user_question']}**, based on {len(rows)} aggregated data points. "
                f"The leading segment is **{rows[0].get(cols[0], 'N/A')}**, which represents the highest volume among the analyzed groups."
            )
        return f"We analyzed your dataset for **{state['user_question']}**. No matching rows were found with the specified parameters."

    def _deterministic_insights(self, rows: List[Dict[str, Any]], cols: List[str], question: str) -> List[str]:
        if not rows:
            return ["No data points were returned matching the query criteria."]

        insights = [
            f"Query returned {len(rows)} analytical data rows."
        ]
        
        # Check if single row KPI
        if len(rows) == 1:
            for k, v in rows[0].items():
                if v is not None:
                    formatted = f"${v:,.2f}" if isinstance(v, (int, float)) and v > 100 else f"{v}"
                    insights.append(f"Observed {k.replace('_', ' ')}: {formatted}")
            return insights

        # Check top row
        first_row = rows[0]
        if len(cols) >= 2:
            dim_val = first_row.get(cols[0])
            metric_val = first_row.get(cols[1])
            if metric_val is not None and isinstance(metric_val, (int, float)):
                insights.append(f"Top contributor is '{dim_val}' with a metric value of {metric_val:,.2f}.")

        return insights
