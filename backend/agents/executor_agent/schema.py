from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class ExecutorRequest(BaseModel):
    sql: str = Field(..., description="The SQL query to execute.")

class ExecutorResponse(BaseModel):
    success: bool = Field(description="Whether the query executed successfully.")
    data: List[Dict[str, Any]] = Field(default_factory=list, description="The returned rows from the database.")
    row_count: int = Field(default=0, description="The number of rows returned.")
    error: Optional[str] = Field(default=None, description="Error message if execution failed.")
