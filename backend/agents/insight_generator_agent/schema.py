from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class InsightGeneratorRequest(BaseModel):
    user_question: str = Field(..., description="The user's original query.")
    sql: str = Field(..., description="The executed SQL query.")
    execution_result: Dict[str, Any] = Field(..., description="The query execution result (including data or error).")

class InsightGeneratorResponse(BaseModel):
    insights: List[str] = Field(description="2-3 key insights from the data.")
    data_quality_notes: Optional[str] = Field(default=None, description="Notes on data quality or limitations.")
