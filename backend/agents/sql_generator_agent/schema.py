from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class SQLGeneratorRequest(BaseModel):
    user_question: str = Field(..., description="The user's query.")
    intent_result: Dict[str, Any] = Field(..., description="Output from the intent agent.")
    table_result: Dict[str, Any] = Field(..., description="Output from the table agent.")
    plan_result: Dict[str, Any] = Field(..., description="Output from the planner agent.")
    retrieved_context: Dict[str, Any] = Field(..., description="Context retrieved from ChromaDB.")
    error_message: Optional[str] = Field(default=None, description="Previous error message if retrying.")

class SQLGeneratorResponse(BaseModel):
    sql: str = Field(description="The generated SQL query.")
    tables_used: List[str] = Field(default_factory=list, description="List of tables used in the query.")
    confidence_score: float = Field(description="Agent's confidence in the generated SQL (0.0 to 1.0).")
    strategy: str = Field(description="The strategy used to generate the SQL (e.g., 'direct', 'reasoning').")
