from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class FormatterRequest(BaseModel):
    user_question: str = Field(..., description="The user's original query.")
    sql_result: Dict[str, Any] = Field(..., description="The winning SQL and metadata.")
    validation_result: Dict[str, Any] = Field(..., description="Validator output.")
    execution_result: Dict[str, Any] = Field(..., description="Execution output including data.")
    intent_result: Dict[str, Any] = Field(..., description="Intent classification.")
    plan_result: Dict[str, Any] = Field(..., description="Planner suggestions (chart type, steps).")

class FormatterResponse(BaseModel):
    nl_summary: str = Field(description="A concise, natural-language answer to the user's question.")
    confidence_score: float = Field(description="Overall confidence in the answer (0.0 to 1.0).")
    chart_type: Optional[str] = Field(default=None, description="Recommended chart type.")
    chart_data: Dict[str, Any] = Field(default_factory=dict, description="Data formatted for the chart.")
    applied_filters: Dict[str, Any] = Field(default_factory=dict, description="Filters applied to the data.")
    follow_up_suggestions: List[str] = Field(default_factory=list, description="Suggested follow-up questions.")
    data_warnings: List[str] = Field(default_factory=list, description="Any caveats about the data.")
