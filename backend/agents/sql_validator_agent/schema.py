from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class ValidatorRequest(BaseModel):
    user_question: str = Field(..., description="The user's query.")
    sql: str = Field(..., description="The generated SQL query.")
    schema_info: str = Field(..., description="Database schema info.")

class ValidatorResponse(BaseModel):
    is_valid: bool = Field(description="Whether the SQL passed all validation checks.")
    checks: Dict[str, bool] = Field(description="Results for safety, syntax, and schema checks.")
    error_message: Optional[str] = Field(default=None, description="Error message if validation fails.")
    fix_suggestion: Optional[str] = Field(default=None, description="Suggested fix for the error.")
