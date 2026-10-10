export interface AIConfig {
  id: string;
  provider: string; // groq, openrouter, openai, gemini
  model_name: string;
  api_key: string;
  is_default?: boolean;
}

export interface PlanResult {
  intent: string;
  chart_type: string;
  title: string;
  x_axis: string | null;
  y_axis: string | null;
  sql: string;
  clarification_question?: string | null;
  clarification_options?: string[];
}

export interface InsightsResult {
  explanation: string;
  insights: string[];
}

function cleanJsonText(raw: string): string {
  let cleaned = raw.trim();
  const jsonBlock = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(cleaned);
  if (jsonBlock && jsonBlock[1]) {
    cleaned = jsonBlock[1].trim();
  }
  return cleaned;
}

export class BrowserAIService {
  private getEndpoint(provider: string): string {
    switch (provider.toLowerCase()) {
      case "groq":
        return "https://api.groq.com/openai/v1/chat/completions";
      case "openrouter":
        return "https://openrouter.ai/api/v1/chat/completions";
      case "openai":
        return "https://api.openai.com/v1/chat/completions";
      case "gemini":
        return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      default:
        return "https://api.groq.com/openai/v1/chat/completions";
    }
  }

  private async callChatCompletion(config: AIConfig, messages: any[], temperature = 0.1): Promise<string> {
    const endpoint = this.getEndpoint(config.provider);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.api_key}`,
    };

    if (config.provider.toLowerCase() === "openrouter") {
      headers["HTTP-Referer"] = window.location.origin;
      headers["X-Title"] = "Autoanalytix";
    }

    const payload = {
      model: config.model_name || "llama-3.1-8b-instant",
      messages,
      temperature,
      response_format: { type: "json_object" },
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const msg = errBody?.error?.message || res.statusText || "AI API call failed";
      throw new Error(`AI Provider Error (${config.provider}): ${msg}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  public async generatePlanAndSql(
    config: AIConfig,
    params: {
      question: string;
      tableName: string;
      columns: Array<{ name: string; duckdb_type: string; data_type: string; stats?: any }>;
      history?: Array<{ role: string; content: string }>;
    }
  ): Promise<PlanResult> {
    const columnsInfo = params.columns
      .map((c) => `- "${c.name}" (${c.duckdb_type}, ${c.data_type})`)
      .join("\n");

    const statsInfo = params.columns
      .filter((c) => c.stats && Object.keys(c.stats).length > 0)
      .map((c) => `- "${c.name}": min=${c.stats.min}, max=${c.stats.max}, mean=${c.stats.mean}, nulls=${c.stats.null_count}`)
      .join("\n");

    const historyStr = (params.history || [])
      .map((h) => `${h.role}: ${h.content}`)
      .join("\n");

    const systemPrompt = `You are an expert analytical planner and SQL engineer for DuckDB.
Your task is to analyze the user's question, inspect the dataset schema and statistics, and produce a structured analysis plan and DuckDB SQL query.

TABLE NAME TO QUERY: "${params.tableName}"
SCHEMA COLUMNS AND TYPES:
${columnsInfo}

SAMPLE METRIC STATS:
${statsInfo || "None"}

CONVERSATION HISTORY (if follow-up):
${historyStr || "None"}

RULES:
1. ONLY query the table "${params.tableName}". Do NOT query any other table.
2. Generate strictly read-only DuckDB SQL (SELECT only).
3. Always choose appropriate aggregations (SUM, AVG, COUNT, MIN, MAX).
4. If the question involves monthly/quarterly trends and there's a date column, use DuckDB date functions like \`strftime(order_date, '%Y-%m') AS month\` or \`date_trunc('month', order_date)\`.
5. If the user question is completely ambiguous or references columns that clearly do not exist, specify \`clarification_question\` and 2-4 \`clarification_options\`.
6. Select an appropriate chart type: 'kpi', 'bar', 'horizontal_bar', 'line', 'area', 'pie', 'donut', 'scatter', or 'table'.
7. For KPI cards, calculate a single aggregated value (e.g., total revenue, average order value).

Respond ONLY with a valid JSON object matching this schema:
{
  "intent": "time_series | ranking | aggregation | breakdown | comparison",
  "chart_type": "kpi | bar | horizontal_bar | line | area | pie | donut | scatter | table",
  "title": "Clear descriptive chart title",
  "x_axis": "column_name_for_x or null",
  "y_axis": "column_name_for_y or null",
  "sql": "SELECT ... FROM \\"${params.tableName}\\" ...",
  "clarification_question": null,
  "clarification_options": []
}`;

    const raw = await this.callChatCompletion(config, [
      { role: "system", content: systemPrompt },
      { role: "user", content: params.question },
    ]);

    try {
      return JSON.parse(cleanJsonText(raw)) as PlanResult;
    } catch {
      throw new Error("Failed to parse analysis plan from AI provider.");
    }
  }

  public async generateInsights(
    config: AIConfig,
    params: {
      question: string;
      sql: string;
      tableName: string;
      columns: Array<{ name: string; data_type: string }>;
      results: any[];
    }
  ): Promise<InsightsResult> {
    const previewRows = JSON.stringify(params.results.slice(0, 15), null, 2);
    const schemaSummary = params.columns.map((c) => `${c.name} (${c.data_type})`).join(", ");

    const systemPrompt = `You are a senior business intelligence consultant explaining data to a non-technical business executive.
Ground your explanation and findings strictly in the actual query results, schema, and statistics provided below.
Do NOT invent numbers, percentages, or facts that are not present in the data.

USER QUESTION: ${params.question}
DATASET SCHEMA: ${schemaSummary}
EXECUTED SQL: ${params.sql}
QUERY RESULTS (First 15 rows):
${previewRows}

Provide:
1. "explanation": A warm, lucid, and thorough narrative explanation (2 to 3 paragraphs) written in clear, plain business English.
   - If the user asked "describe my data", "what is this dataset", or similar, explain what business operations or activity this data tracks, total scale/volume, key dimensions, and primary metrics available.
   - Avoid technical jargon, SQL keywords, or raw database syntax.
   - Focus on what the numbers mean for business decision-makers.
2. "insights": 2 to 4 concise bullet points highlighting key numbers, top drivers, or notable comparisons.

Respond ONLY with a valid JSON object matching this schema:
{
  "explanation": "Plain-language business narrative explanation...",
  "insights": [
    "Observed: Total revenue reached $1,420,500 across 1,200 orders.",
    "Calculated: Enterprise segment generated the highest revenue share at 48.2%."
  ]
}`;

    const raw = await this.callChatCompletion(config, [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Explain these results clearly." },
    ]);

    try {
      return JSON.parse(cleanJsonText(raw)) as InsightsResult;
    } catch {
      return {
        explanation: "Analysis completed successfully based on your dataset.",
        insights: ["Review the table and chart visualization above."],
      };
    }
  }
}

export const browserAi = new BrowserAIService();
