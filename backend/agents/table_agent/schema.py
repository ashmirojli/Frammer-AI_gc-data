from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class TableRequest(BaseModel):
    user_question: str = Field(..., description="The user's query.")
    intent_result: Dict[str, Any] = Field(..., description="The output from the intent agent.")
    retrieved_context: Dict[str, Any] = Field(..., description="Context retrieved from ChromaDB.")

class TableResponse(BaseModel):
    primary_table: Optional[str] = Field(description="The main fact table to query.")
    dimensions: List[str] = Field(default_factory=list, description="Associated dimension tables required.")
    pipeline_error: Optional[str] = Field(default=None, description="Error message if tables cannot be matched.")
    short_circuit: bool = Field(default=False, description="Whether to stop the pipeline early.")
