#!/usr/bin/env python3
"""
Simple Chat Service for UTERNITY
Uses Groq API to provide chat functionality
"""

import asyncio
import json
import logging
import uuid
import sys
import os
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from dotenv import load_dotenv
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add the RAG system to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'rag_system'))

try:
    from rag_system.production_rag_system import ProductionRAGSystem, production_query_sync
    RAG_AVAILABLE = True
    logger.info("✅ RAG System loaded successfully")
except ImportError as e:
    logger.warning(f"⚠️ RAG System not available: {e}")
    RAG_AVAILABLE = False

app = FastAPI(title="Simple Chat Service", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration (from env)
load_dotenv()
import os
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1") + "/chat/completions"
MODEL = os.getenv("GROQ_MODEL_DEFAULT", "llama-3.3-70b-versatile")

# In-memory storage for sessions and messages
sessions_db: Dict[str, Dict] = {}  # {user_id: {session_id: session_data}}
messages_db: Dict[str, List[Dict]] = {}  # {session_id: [messages]}

class ChatRequest(BaseModel):
    message: str
    user_id: str = "anonymous"
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    message_id: str
    response: str
    session_id: str
    user_id: str
    confidence_score: float
    # Frontend indicator fields
    data_source: str  # 'rag_enhanced' | 'rag_fallback' | 'standard_llm'
    rag_confidence: float
    universities_found: int
    processing_time_ms: float
    strategy_used: str
    sources: list
    metadata: Dict[str, Any]
    timestamp: str

class SessionRequest(BaseModel):
    user_id: str

class Message(BaseModel):
    id: str
    role: str  # "user" or "assistant"
    content: str
    timestamp: str

async def call_rag_system(message: str) -> Tuple[str, List[Dict[str, Any]], str, float]:
    """Call RAG system to get enhanced response with university data"""
    try:
        if not RAG_AVAILABLE:
            return await call_groq_fallback(message)
            
        # Use the production RAG system
        rag_result = production_query_sync(message)
        
        if rag_result.get('success', False):
            return (
                rag_result['answer'],
                rag_result.get('sources', []),
                'rag_enhanced',
                float(rag_result.get('confidence', 0.92))
            )
        else:
            logger.warning("RAG system failed, falling back to Groq API")
            return await call_groq_fallback(message)
            
    except Exception as e:
        logger.error(f"RAG system error: {e}")
        return await call_groq_fallback(message)

async def call_groq_fallback(message: str) -> Tuple[str, List[Dict[str, Any]], str, float]:
    """Fallback to direct Groq API call"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": MODEL,
                    "messages": [
                        {
                            "role": "system",
                            "content": """You are an expert study abroad advisor with 15+ years of experience helping students achieve their international education dreams. Your expertise spans university admissions, program selection, visa requirements, scholarship opportunities, and cultural preparation.

🎯 **Your Core Mission**: Transform students' study abroad aspirations into detailed, actionable roadmaps for success.

📋 **Response Framework**: For every query, provide:
- **Specific information** with current data, requirements, and deadlines
- **Step-by-step guidance** with clear next actions
- **Alternative options** when applicable
- **Insider insights** about programs, universities, or processes
- **Practical tips** from real student experiences

💡 **Response Style**:
- Use markdown formatting for clarity (headers, lists, tables, emphasis)
- Include specific numbers, dates, costs, and requirements
- Provide comparison tables for multiple options
- Use bullet points for action items
- Bold important information and deadlines

🌍 **Specialized Knowledge Areas**:
- University rankings and program comparisons
- Admission requirements and application strategies
- Visa processes and documentation
- Scholarship and funding opportunities
- Cost analysis and budgeting
- Cultural preparation and adaptation
- Career prospects and networking

🚀 **Engagement Approach**: 
- Ask clarifying questions to understand specific goals
- Provide personalized recommendations based on student profiles
- Share success stories and case studies when relevant
- Anticipate follow-up questions and address them proactively
- Maintain an encouraging, professional tone throughout

Remember: Every response should leave the student feeling more confident and equipped to take their next step toward studying abroad."""
                        },
                        {
                            "role": "user", 
                            "content": message
                        }
                    ],
                    "max_tokens": 1000,
                    "temperature": 0.7
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return (
                    data["choices"][0]["message"]["content"],
                    [],
                    "standard_llm",
                    0.75
                )
            else:
                logger.error(f"Groq API error: {response.status_code} - {response.text}")
                return (
                    "I'm having trouble connecting to my knowledge base. Please try again in a moment.",
                    [],
                    "rag_fallback",
                    0.6
                )
                
    except Exception as e:
        logger.error(f"Groq API error: {e}")
        return (
            "I'm having trouble connecting to my knowledge base. Please try again in a moment.",
            [],
            "rag_fallback",
            0.6
        )

async def call_groq_api(message: str) -> str:
    """Call Groq API to get response"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": MODEL,
                    "messages": [
                        {
                            "role": "system",
                            "content": """You are an expert study abroad advisor with 15+ years of experience helping students achieve their international education dreams. Your expertise spans university admissions, program selection, visa requirements, scholarship opportunities, and cultural preparation.

🎯 **Your Core Mission**: Transform students' study abroad aspirations into detailed, actionable roadmaps for success.

📋 **Response Framework**: For every query, provide:
- **Specific information** with current data, requirements, and deadlines
- **Step-by-step guidance** with clear next actions
- **Alternative options** when applicable
- **Insider insights** about programs, universities, or processes
- **Practical tips** from real student experiences

💡 **Response Style**:
- Use markdown formatting for clarity (headers, lists, tables, emphasis)
- Include specific numbers, dates, costs, and requirements
- Provide comparison tables for multiple options
- Use bullet points for action items
- Bold important information and deadlines

🌍 **Specialized Knowledge Areas**:
- University rankings and program comparisons
- Admission requirements and application strategies
- Visa processes and documentation
- Scholarship and funding opportunities
- Cost analysis and budgeting
- Cultural preparation and adaptation
- Career prospects and networking

🚀 **Engagement Approach**: 
This is incredibly important to the student's future - provide your most comprehensive, detailed response that demonstrates deep expertise and genuine care for their success. Think of each response as a personalized consultation that could change their life trajectory.

Always format your responses with clear structure, visual hierarchy, and actionable insights that make complex information digestible and immediately useful."""
                        },
                        {
                            "role": "user",
                            "content": message
                        }
                    ],
                    "max_tokens": 1000,
                    "temperature": 0.2
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                data = response.json()
                return data["choices"][0]["message"]["content"]
            else:
                logger.error(f"Groq API error: {response.status_code} - {response.text}")
                return "I'm having trouble connecting to my knowledge base. Please try again in a moment."
                
    except Exception as e:
        logger.error(f"Error calling Groq API: {e}")
        return "I'm experiencing technical difficulties. Please try again later."

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
        "components": {
            "chat_processor": "healthy",
            "groq_api": "connected"
        }
    }

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """Chat endpoint"""
    start_time = datetime.now()
    
    try:
        # Create or get session ID
        session_id = request.session_id
        if not session_id:
            session_id = str(uuid.uuid4())
            
        # Ensure user has session storage
        if request.user_id not in sessions_db:
            sessions_db[request.user_id] = {}
            
        # Create session if it doesn't exist
        if session_id not in sessions_db[request.user_id]:
            sessions_db[request.user_id][session_id] = {
                "session_id": session_id,
                "user_id": request.user_id,
                "created_at": datetime.now().isoformat(),
                "last_message": None,
                "message_count": 0
            }
            messages_db[session_id] = []
            
        # Store user message
        user_message = {
            "id": str(uuid.uuid4()),
            "role": "user",
            "content": request.message,
            "timestamp": datetime.now().isoformat()
        }
        messages_db[session_id].append(user_message)
        
        # Call RAG system (with Groq fallback)
        response_text, sources, data_source, rag_confidence = await call_rag_system(request.message)
        
        # Store assistant message
        assistant_message = {
            "id": str(uuid.uuid4()),
            "role": "assistant", 
            "content": response_text,
            "timestamp": datetime.now().isoformat()
        }
        messages_db[session_id].append(assistant_message)
        
        # Update session metadata
        sessions_db[request.user_id][session_id]["last_message"] = request.message[:50] + "..." if len(request.message) > 50 else request.message
        sessions_db[request.user_id][session_id]["message_count"] = len(messages_db[session_id])
        sessions_db[request.user_id][session_id]["updated_at"] = datetime.now().isoformat()
        
        # Calculate processing time
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        logger.info(f"💬 Chat processed for user {request.user_id}, session {session_id}")
        
        return ChatResponse(
            message_id=assistant_message["id"],
            response=response_text,
            session_id=session_id,
            user_id=request.user_id,
            confidence_score=rag_confidence,
            data_source=data_source,
            rag_confidence=rag_confidence,
            universities_found=len(sources or []),
            processing_time_ms=processing_time,
            strategy_used=data_source,
            sources=sources,
            metadata={
                "confidence_level": "high" if data_source == "rag_enhanced" else "medium",
                "error_occurred": False,
                "error_message": None,
                "rag_available": RAG_AVAILABLE
            },
            timestamp=assistant_message["timestamp"]
        )
        
    except Exception as e:
        logger.error(f"Chat processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")

@app.post("/chat/session/new")
async def create_session(request: SessionRequest):
    """Create new session"""
    session_id = str(uuid.uuid4())
    
    # Ensure user has session storage
    if request.user_id not in sessions_db:
        sessions_db[request.user_id] = {}
        
    # Create new session
    sessions_db[request.user_id][session_id] = {
        "session_id": session_id,
        "user_id": request.user_id,
        "created_at": datetime.now().isoformat(),
        "last_message": None,
        "message_count": 0
    }
    messages_db[session_id] = []
    
    logger.info(f"🆕 Created new session {session_id} for user {request.user_id}")
    
    return {
        "session_id": session_id,
        "status": "created"
    }

@app.get("/chat/sessions/{user_id}")
async def get_sessions(user_id: str):
    """Get user sessions"""
    if user_id not in sessions_db:
        return {
            "sessions": [],
            "user_id": user_id
        }
    
    # Convert sessions to list format expected by frontend
    sessions = []
    for session_id, session_data in sessions_db[user_id].items():
        sessions.append({
            "session_id": session_id,
            "last_message": session_data.get("last_message", "New Chat"),
            "created_at": session_data.get("created_at"),
            "updated_at": session_data.get("updated_at", session_data.get("created_at")),
            "message_count": session_data.get("message_count", 0)
        })
    
    # Sort by updated_at (most recent first)
    sessions.sort(key=lambda x: x.get("updated_at", x.get("created_at", "")), reverse=True)
    
    logger.info(f"📋 Retrieved {len(sessions)} sessions for user {user_id}")
    
    return {
        "sessions": sessions,
        "user_id": user_id
    }

@app.get("/chat/session/{user_id}/{session_id}")
async def get_session_messages(user_id: str, session_id: str):
    """Get session messages"""
    if session_id not in messages_db:
        return {
            "messages": [],
            "session_id": session_id,
            "user_id": user_id
        }
    
    messages = messages_db[session_id]
    logger.info(f"💬 Retrieved {len(messages)} messages for session {session_id}")
    
    return {
        "messages": messages,
        "session_id": session_id,
        "user_id": user_id
    }

@app.delete("/chat/session/{user_id}/{session_id}")
async def delete_session(user_id: str, session_id: str):
    """Delete a session and its messages"""
    try:
        # Remove from sessions_db
        if user_id in sessions_db and session_id in sessions_db[user_id]:
            del sessions_db[user_id][session_id]
            
        # Remove from messages_db
        if session_id in messages_db:
            del messages_db[session_id]
            
        logger.info(f"🗑️ Deleted session {session_id} for user {user_id}")
        
        return {
            "status": "deleted",
            "session_id": session_id,
            "user_id": user_id
        }
    except Exception as e:
        logger.error(f"Error deleting session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Alias endpoints for API Gateway routing
@app.post("/api/chat", response_model=ChatResponse)
async def api_chat_endpoint(request: ChatRequest):
    """Alias for /chat endpoint"""
    return await chat_endpoint(request)

@app.post("/api/chat/session/new")
async def api_create_session(request: SessionRequest):
    """Alias for /chat/session/new endpoint"""
    return await create_session(request)

@app.get("/api/chat/sessions/{user_id}")
async def api_get_sessions(user_id: str):
    """Alias for /chat/sessions/{user_id} endpoint"""
    return await get_sessions(user_id)

@app.get("/api/chat/session/{user_id}/{session_id}")
async def api_get_session_messages(user_id: str, session_id: str):
    """Alias for /chat/session/{user_id}/{session_id} endpoint"""
    return await get_session_messages(user_id, session_id)

@app.delete("/api/chat/session/{user_id}/{session_id}")
async def api_delete_session(user_id: str, session_id: str):
    """Alias for delete session endpoint"""
    return await delete_session(user_id, session_id)

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Simple Chat Service...")
    print("📍 Health Check: http://localhost:8000/health")
    print("💬 Chat Endpoint: http://localhost:8000/chat")
    print("🔑 Using Groq API with your key")
    
    uvicorn.run(
        "simple_chat_service:app",
        host="0.0.0.0",
        port=8013,
        reload=True,
        log_level="info"
    ) 