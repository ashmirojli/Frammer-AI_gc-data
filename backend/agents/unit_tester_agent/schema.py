from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class EvaluatedCandidate(BaseModel):
    sql: str = Field(description="The SQL candidate.")
    strategy: str = Field(description="The strategy used.")
    score: int = Field(description="The score assigned by the unit tester.")
    execution_success: bool = Field(description="Whether the query executed successfully.")
    row_count: int = Field(description="Number of rows returned.")
    error: Optional[str] = Field(default=None, description="Error message if execution failed.")

class UnitTesterRequest(BaseModel):
    user_question: str = Field(..., description="The user's query.")
    sql_candidates: List[Dict[str, Any]] = Field(..., description="List of SQL candidates.")

class UnitTesterResponse(BaseModel):
    best_candidate: Optional[Dict[str, Any]] = Field(default=None, description="The winning SQL candidate.")
    scores: List[EvaluatedCandidate] = Field(default_factory=list, description="Details of all evaluated candidates.")
