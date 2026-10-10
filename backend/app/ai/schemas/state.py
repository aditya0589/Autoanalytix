from typing import TypedDict, List, Dict, Any, Optional

class AnalyticsState(TypedDict):
    user_id: str
    workspace_id: str
    dataset_id: str
    dataset_table_name: str
    conversation_id: str
    provider_config_id: Optional[str]

    user_question: str
    conversation_history: List[Dict[str, str]]
    dataset_schema: List[Dict[str, Any]]
    dataset_profile: Dict[str, Any]
    
    # LLM & Planning
    analysis_plan: Optional[Dict[str, Any]]
    generated_sql: Optional[str]
    sql_retry_count: int
    query_result: Optional[Dict[str, Any]]
    chart_specification: Optional[Dict[str, Any]]
    insights: List[str]
    explanation: Optional[str]

    # Flow Control
    clarification_question: Optional[str]
    clarification_options: Optional[List[str]]
    error: Optional[str]
    status: str  # planning, executing, complete, clarification, failed
