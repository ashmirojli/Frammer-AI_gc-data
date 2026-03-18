from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class IntentRequest(BaseModel):
    user_question: str = Field(..., description="The user's query.")
    conversation_history: List[Dict[str, str]] = Field(default_factory=list, description="Previous chat history.")

class IntentResponse(BaseModel):
    intent: str = Field(description="The classified intent of the query.")
    is_safe: bool = Field(description="Whether the query is safe from prompt injection or harmful content.")
    missing_context: List[str] = Field(default_factory=list, description="Any context missing to fulfill the query.")
    is_answerable: bool = Field(description="Whether the query can be answered using the available schema.")
    pipeline_error: Optional[str] = Field(default=None, description="Error message if short-circuiting.")
