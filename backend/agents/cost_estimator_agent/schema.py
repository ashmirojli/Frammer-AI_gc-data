from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class CostEstimatorRequest(BaseModel):
    sql: str = Field(..., description="The generated SQL query.")

class CostEstimatorResponse(BaseModel):
    estimated_cost: str = Field(description="Estimated cost level: 'low', 'medium', 'high'.")
    full_table_scan: bool = Field(description="Whether a full table scan is detected.")
    warnings: List[str] = Field(default_factory=list, description="Performance warnings.")
