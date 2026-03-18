from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class PlannerRequest(BaseModel):
    user_question: str = Field(..., description="The user's query.")
    intent_result: Dict[str, Any] = Field(..., description="Output from the intent agent.")
    table_result: Dict[str, Any] = Field(..., description="Output from the table agent.")

class PlannerResponse(BaseModel):
    chart_type: str = Field(description="The recommended chart type (e.g., kpi_card, line_chart).")
    steps: List[str] = Field(default_factory=list, description="Step-by-step reasoning plan.")
    required_columns: List[str] = Field(default_factory=list, description="Columns needed to fulfill the query.")
