#!/usr/bin/env python3
"""
Simple Voice Service for UTERNITY
Serves TOEFL and IELTS instruction pages
"""

import logging
from datetime import datetime
from typing import Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Simple Voice Service", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
frontend_dir = Path(__file__).parent / "frontend"

class VoiceResponse(BaseModel):
    message: str
    timestamp: str
    service: str = "voice"

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
        "components": {
            "voice_processor": "healthy",
            "instruction_pages": "available"
        }
    }

@app.get("/toefl-instructions")
async def toefl_instructions():
    """Serve TOEFL instructions page"""
    try:
        toefl_file = frontend_dir / "toefl-instructions.html"
        if toefl_file.exists():
            with open(toefl_file, 'r', encoding='utf-8') as f:
                content = f.read()
                return HTMLResponse(content=content)
        else:
            return HTMLResponse(content="<h1>TOEFL Instructions Page Not Found</h1>", status_code=404)
    except Exception as e:
        logger.error(f"Error serving TOEFL instructions page: {e}")
        return HTMLResponse(content="<h1>Error Loading TOEFL Instructions</h1>", status_code=500)

@app.get("/ielts-instructions")
async def ielts_instructions():
    """Serve IELTS instructions page"""
    try:
        ielts_file = frontend_dir / "ielts-instructions.html"
        if ielts_file.exists():
            with open(ielts_file, 'r', encoding='utf-8') as f:
                content = f.read()
                return HTMLResponse(content=content)
        else:
            return HTMLResponse(content="<h1>IELTS Instructions Page Not Found</h1>", status_code=404)
    except Exception as e:
        logger.error(f"Error serving IELTS instructions page: {e}")
        return HTMLResponse(content="<h1>Error Loading IELTS Instructions</h1>", status_code=500)

@app.get("/api/v1/health/")
async def voice_health():
    """Voice service health check"""
    return {
        "status": "healthy",
        "service": "voice-agent",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Voice Agent Service",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "toefl_instructions": "/toefl-instructions",
            "ielts_instructions": "/ielts-instructions"
        }
    }

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Simple Voice Service...")
    print("📍 Health Check: http://localhost:8005/health")
    print("📚 TOEFL Instructions: http://localhost:8005/toefl-instructions")
    print("📚 IELTS Instructions: http://localhost:8005/ielts-instructions")
    
    uvicorn.run(
        "simple_voice_service:app",
        host="0.0.0.0",
        port=8005,
        reload=True,
        log_level="info"
    ) 