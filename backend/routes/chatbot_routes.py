from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import sys
sys.path.append('/app/backend')
from services.chatbot_service import (
    process_chat_message,
    save_chat_message,
    get_chat_history,
    FUNCTION_MAP
)

router = APIRouter()

# Models
class ChatMessage(BaseModel):
    message: str
    session_id: str
    user_role: str  # 'admin' or 'driver'
    user_name: Optional[str] = None  # For driver queries

class ChatResponse(BaseModel):
    response: str
    session_id: str

class ChatHistoryResponse(BaseModel):
    messages: List[dict]

class FunctionCallRequest(BaseModel):
    function_name: str
    parameters: dict
    user_role: str

@router.post("/chat", response_model=dict)
async def chat(message: ChatMessage):
    """
    Send a message to the AI chatbot
    
    The chatbot can call functions to:
    - Get bin status information
    - Get driver information
    - Trigger automatic assignments
    - Get driver's completed/pending bins
    """
    try:
        # Save user message
        await save_chat_message(
            session_id=message.session_id,
            role="user",
            content=message.message,
            user_role=message.user_role
        )
        
        # Process message with AI
        ai_response = await process_chat_message(
            user_message=message.message,
            session_id=message.session_id,
            user_role=message.user_role
        )
        
        # Save AI response
        await save_chat_message(
            session_id=message.session_id,
            role="assistant",
            content=ai_response,
            user_role=message.user_role
        )
        
        return {
            "success": True,
            "data": {
                "response": ai_response,
                "session_id": message.session_id
            },
            "message": "Chat response generated"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")

@router.get("/history/{session_id}", response_model=dict)
async def get_history(session_id: str, limit: int = 50):
    """Get chat history for a session"""
    try:
        messages = await get_chat_history(session_id, limit)
        
        return {
            "success": True,
            "data": {
                "messages": messages,
                "count": len(messages)
            },
            "message": "Chat history retrieved"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving history: {str(e)}")

@router.post("/function-call", response_model=dict)
async def call_function(request: FunctionCallRequest):
    """
    Directly call a function (for testing or explicit function calls)
    """
    try:
        if request.function_name not in FUNCTION_MAP:
            raise HTTPException(status_code=404, detail=f"Function {request.function_name} not found")
        
        func = FUNCTION_MAP[request.function_name]
        result = await func(**request.parameters)
        
        return {
            "success": True,
            "data": result,
            "message": f"Function {request.function_name} executed successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Function execution error: {str(e)}")

@router.get("/functions", response_model=dict)
async def list_functions():
    """List all available functions"""
    try:
        from services.chatbot_service import FUNCTIONS
        
        return {
            "success": True,
            "data": {
                "functions": FUNCTIONS,
                "count": len(FUNCTIONS)
            },
            "message": "Functions listed"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing functions: {str(e)}")
