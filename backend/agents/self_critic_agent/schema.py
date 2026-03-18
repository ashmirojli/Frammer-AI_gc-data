from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class SelfCriticRequest(BaseModel):
    user_question: str = Field(..., description="The user's query.")
    sql: str = Field(..., description="The generated SQL query.")
    schema_info: Dict[str, Any] = Field(..., description="Database schema info.")

class SelfCriticResponse(BaseModel):
    valid: bool = Field(description="Whether the SQL correctly answers the user's intent.")
    critique: str = Field(description="Explanation of the critique.")
    error_message: Optional[str] = Field(default=None, description="Clear description of the logical flaw, if any.")
