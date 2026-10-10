from typing import List, Dict, Any, Optional
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.language_models.chat_models import BaseChatModel
from app.analytics.engine import analytics_engine
from app.analytics.sql_validator import SQLValidator
from app.ai.agents.analytics_graph import extract_json

DASHBOARD_GENERATION_PROMPT = """You are a senior BI dashboard architect.
Given this dataset schema and user prompt, design an executive dashboard consisting of 4 to 6 widgets.
Each widget must calculate real numbers from table `{table_name}`.

COLUMNS:
{columns_info}

USER GOAL:
{prompt}

RULES:
1. Design at least 2 KPI cards (single aggregate number e.g. SUM(revenue), SUM(profit), COUNT(*)).
2. Design at least 1 Time Series chart (if date column exists) using monthly or quarterly aggregation.
3. Design at least 1 Breakdown / Ranking chart (bar or donut chart).
4. Output valid, read-only DuckDB SQL for each widget.
5. Define grid positions on a 12-column grid (x: 0-11, y: 0+, w: 1-12, h: 2-6).

Respond ONLY with a JSON object matching this schema:
{{
  "title": "Executive Dashboard Title",
  "description": "Short executive summary of what this dashboard tracks",
  "widgets": [
    {{
      "title": "Total Revenue",
      "widget_type": "kpi",
      "grid_pos": {{ "x": 0, "y": 0, "w": 4, "h": 2 }},
      "chart_type": "kpi",
      "sql": "SELECT round(sum(revenue), 2) AS total_revenue FROM {table_name}"
    }},
    {{
      "title": "Monthly Trend",
      "widget_type": "chart",
      "grid_pos": {{ "x": 0, "y": 2, "w": 8, "h": 4 }},
      "chart_type": "line",
      "x_axis": "month",
      "y_axis": "total_revenue",
      "sql": "SELECT substr(cast(order_date as varchar), 1, 7) AS month, sum(revenue) as total_revenue FROM {table_name} GROUP BY 1 ORDER BY 1"
    }}
  ]
}}
"""

class DashboardGeneratorWorkflow:
    def __init__(self, llm: Optional[BaseChatModel] = None):
        self.llm = llm

    def generate_dashboard(
        self,
        table_name: str,
        columns: List[Dict[str, Any]],
        prompt: str
    ) -> Dict[str, Any]:
        columns_info = "\n".join([f"- {c['name']} ({c['data_type']})" for c in columns])
        clean_table = table_name.lower().replace("-", "_")

        raw_plan = None
        if self.llm:
            try:
                res = self.llm.invoke([
                    SystemMessage(content=DASHBOARD_GENERATION_PROMPT.format(
                        table_name=clean_table,
                        columns_info=columns_info,
                        prompt=prompt
                    )),
                    HumanMessage(content=prompt)
                ])
                raw_plan = extract_json(res.content)
            except Exception:
                raw_plan = None

        if not raw_plan or not isinstance(raw_plan, dict) or "widgets" not in raw_plan:
            raw_plan = self._fallback_dashboard_plan(clean_table, columns, prompt)

        executed_widgets = []
        for w in raw_plan.get("widgets", []):
            sql = w.get("sql")
            chart_type = w.get("chart_type", "bar")
            title = w.get("title", "Widget")
            grid_pos = w.get("grid_pos", {"x": 0, "y": 0, "w": 6, "h": 4})
            
            try:
                sanitized_sql = SQLValidator.validate_and_sanitize(sql, clean_table)
                res = analytics_engine.execute_query(sanitized_sql, clean_table)
                rows = res.get("rows", [])
                cols = res.get("columns", [])

                kpi_val = None
                kpi_sub = None
                if (w.get("widget_type") == "kpi" or chart_type == "kpi") and rows:
                    first_row = rows[0]
                    kpi_val = list(first_row.values())[0] if first_row else None
                    kpi_sub = "Computed across dataset"

                chart_spec = {
                    "type": chart_type,
                    "title": title,
                    "x_axis": w.get("x_axis") or (cols[0] if cols else None),
                    "y_axis": w.get("y_axis") or (cols[1] if len(cols) > 1 else None),
                    "kpi_value": kpi_val,
                    "kpi_subtext": kpi_sub,
                    "data": rows[:50]
                }

                executed_widgets.append({
                    "title": title,
                    "widget_type": w.get("widget_type", "chart"),
                    "grid_pos": grid_pos,
                    "chart_spec": chart_spec,
                    "cached_data": {"rows": rows[:50], "columns": cols},
                    "config": {"sql": sanitized_sql}
                })
            except Exception as e:
                # If a specific widget fails, skip it gracefully rather than aborting whole dashboard
                continue

        return {
            "title": raw_plan.get("title", "Executive AI Dashboard"),
            "description": raw_plan.get("description", "Automated business intelligence overview"),
            "widgets": executed_widgets
        }

    def _fallback_dashboard_plan(self, table: str, columns: List[Dict[str, Any]], prompt: str) -> Dict[str, Any]:
        num_cols = [c["name"] for c in columns if c.get("data_type") == "numeric"]
        cat_cols = [c["name"] for c in columns if c.get("data_type") == "categorical"]
        date_cols = [c["name"] for c in columns if c.get("data_type") == "datetime"]

        m1 = num_cols[0] if num_cols else "1"
        m2 = num_cols[1] if len(num_cols) > 1 else m1
        d1 = cat_cols[0] if cat_cols else "col"
        d2 = cat_cols[1] if len(cat_cols) > 1 else d1
        date_c = date_cols[0] if date_cols else None

        widgets = [
            {
                "title": f"Total {m1.replace('_', ' ').title()}",
                "widget_type": "kpi",
                "chart_type": "kpi",
                "grid_pos": {"x": 0, "y": 0, "w": 4, "h": 2},
                "sql": f"SELECT round(sum({m1}), 2) AS total_{m1} FROM {table}"
            },
            {
                "title": f"Total {m2.replace('_', ' ').title()}",
                "widget_type": "kpi",
                "chart_type": "kpi",
                "grid_pos": {"x": 4, "y": 0, "w": 4, "h": 2},
                "sql": f"SELECT round(sum({m2}), 2) AS total_{m2} FROM {table}"
            },
            {
                "title": "Total Records Count",
                "widget_type": "kpi",
                "chart_type": "kpi",
                "grid_pos": {"x": 8, "y": 0, "w": 4, "h": 2},
                "sql": f"SELECT count(*) AS total_count FROM {table}"
            }
        ]

        if date_c:
            widgets.append({
                "title": f"Monthly {m1.replace('_', ' ').title()} Growth",
                "widget_type": "chart",
                "chart_type": "line",
                "x_axis": "month",
                "y_axis": f"total_{m1}",
                "grid_pos": {"x": 0, "y": 2, "w": 7, "h": 4},
                "sql": f"SELECT substr(cast({date_c} as varchar), 1, 7) AS month, round(sum({m1}), 2) AS total_{m1} FROM {table} GROUP BY 1 ORDER BY 1"
            })
            widgets.append({
                "title": f"{m1.replace('_', ' ').title()} by {d1.replace('_', ' ').title()}",
                "widget_type": "chart",
                "chart_type": "bar",
                "x_axis": d1,
                "y_axis": f"total_{m1}",
                "grid_pos": {"x": 7, "y": 2, "w": 5, "h": 4},
                "sql": f"SELECT {d1}, round(sum({m1}), 2) AS total_{m1} FROM {table} GROUP BY {d1} ORDER BY total_{m1} DESC LIMIT 6"
            })
        else:
            widgets.append({
                "title": f"{m1.replace('_', ' ').title()} Breakdown",
                "widget_type": "chart",
                "chart_type": "bar",
                "x_axis": d1,
                "y_axis": f"total_{m1}",
                "grid_pos": {"x": 0, "y": 2, "w": 6, "h": 4},
                "sql": f"SELECT {d1}, round(sum({m1}), 2) AS total_{m1} FROM {table} GROUP BY {d1} ORDER BY total_{m1} DESC LIMIT 6"
            })
            widgets.append({
                "title": f"{m2.replace('_', ' ').title()} Distribution by {d2.replace('_', ' ').title()}",
                "widget_type": "chart",
                "chart_type": "pie",
                "x_axis": d2,
                "y_axis": f"total_{m2}",
                "grid_pos": {"x": 6, "y": 2, "w": 6, "h": 4},
                "sql": f"SELECT {d2}, round(sum({m2}), 2) AS total_{m2} FROM {table} GROUP BY {d2} ORDER BY total_{m2} DESC LIMIT 5"
            })

        return {
            "title": "Executive Performance Dashboard",
            "description": f"Automated analytics generated for {table}",
            "widgets": widgets
        }
