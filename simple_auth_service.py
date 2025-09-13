#!/usr/bin/env python3
"""
Simple Authentication Service for UTERNITY
Basic login/logout functionality without complex dependencies
"""

import os
import json
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import uvicorn

# Load environment variables
load_dotenv()

app = FastAPI(
    title="UTERNITY Simple Auth Service",
    description="Simple authentication service for UTERNITY",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# In-memory storage (for demo purposes)
users_db = {
    "demo@uternity.com": {
        "email": "demo@uternity.com",
        "password_hash": hashlib.sha256("demo123".encode()).hexdigest(),
        "name": "Demo User",
        "created_at": datetime.now().isoformat(),
        "is_active": True
    },
    "admin@uternity.com": {
        "email": "admin@uternity.com", 
        "password_hash": hashlib.sha256("admin123".encode()).hexdigest(),
        "name": "Admin User",
        "created_at": datetime.now().isoformat(),
        "is_active": True
    }
}

# Active sessions
sessions_db = {}

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    success: bool
    message: str
    token: Optional[str] = None
    user: Optional[Dict[str, Any]] = None

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "simple_auth",
        "timestamp": datetime.now().isoformat(),
        "users_count": len(users_db),
        "active_sessions": len(sessions_db)
    }

def hash_password(password: str) -> str:
    """Hash password using SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()

def generate_token() -> str:
    """Generate a secure random token"""
    return secrets.token_urlsafe(32)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Verify authentication token"""
    token = credentials.credentials
    if token not in sessions_db:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    session = sessions_db[token]
    if datetime.fromisoformat(session["expires_at"]) < datetime.now():
        del sessions_db[token]
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired"
        )
    
    return session["user"]

@app.post("/api/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """Login endpoint"""
    try:
        email = request.email.lower().strip()
        password_hash = hash_password(request.password)
        
        # Check if user exists and password is correct
        if email not in users_db:
            return LoginResponse(
                success=False,
                message="Invalid email or password"
            )
        
        user = users_db[email]
        if user["password_hash"] != password_hash:
            return LoginResponse(
                success=False,
                message="Invalid email or password"
            )
        
        if not user["is_active"]:
            return LoginResponse(
                success=False,
                message="Account is deactivated"
            )
        
        # Generate token and create session
        token = generate_token()
        expires_at = datetime.now() + timedelta(hours=24)
        
        sessions_db[token] = {
            "user": {
                "email": user["email"],
                "name": user["name"],
                "created_at": user["created_at"]
            },
            "created_at": datetime.now().isoformat(),
            "expires_at": expires_at.isoformat()
        }
        
        return LoginResponse(
            success=True,
            message="Login successful",
            token=token,
            user={
                "email": user["email"],
                "name": user["name"]
            }
        )
        
    except Exception as e:
        print(f"Login error: {e}")
        return LoginResponse(
            success=False,
            message="Login failed due to server error"
        )

@app.post("/api/auth/register", response_model=LoginResponse)
async def register(request: RegisterRequest):
    """Register new user"""
    try:
        email = request.email.lower().strip()
        
        # Check if user already exists
        if email in users_db:
            return LoginResponse(
                success=False,
                message="User already exists"
            )
        
        # Create new user
        password_hash = hash_password(request.password)
        users_db[email] = {
            "email": email,
            "password_hash": password_hash,
            "name": request.name,
            "created_at": datetime.now().isoformat(),
            "is_active": True
        }
        
        return LoginResponse(
            success=True,
            message="Registration successful"
        )
        
    except Exception as e:
        print(f"Registration error: {e}")
        return LoginResponse(
            success=False,
            message="Registration failed due to server error"
        )

@app.post("/api/auth/logout")
async def logout(user: Dict[str, Any] = Depends(verify_token)):
    """Logout endpoint"""
    # Find and remove the session
    token_to_remove = None
    for token, session in sessions_db.items():
        if session["user"]["email"] == user["email"]:
            token_to_remove = token
            break
    
    if token_to_remove:
        del sessions_db[token_to_remove]
    
    return {"success": True, "message": "Logged out successfully"}

@app.get("/api/auth/me")
async def get_current_user(user: Dict[str, Any] = Depends(verify_token)):
    """Get current user info"""
    return {"success": True, "user": user}

@app.get("/api/auth/users")
async def list_users():
    """List all users (for demo purposes)"""
    return {
        "users": [
            {
                "email": user["email"],
                "name": user["name"],
                "created_at": user["created_at"],
                "is_active": user["is_active"]
            }
            for user in users_db.values()
        ]
    }

# Alias endpoints for different routing patterns
@app.post("/auth/login", response_model=LoginResponse)
async def login_alias(request: LoginRequest):
    return await login(request)

@app.post("/auth/register", response_model=LoginResponse)
async def register_alias(request: RegisterRequest):
    return await register(request)

@app.post("/auth/logout")
async def logout_alias(user: Dict[str, Any] = Depends(verify_token)):
    return await logout(user)

@app.get("/auth/me")
async def get_current_user_alias(user: Dict[str, Any] = Depends(verify_token)):
    return await get_current_user(user)

if __name__ == "__main__":
    print("🚀 Starting Simple Authentication Service...")
    print("📍 Health Check: http://localhost:8001/health")
    print("🔐 Login Endpoint: http://localhost:8001/api/auth/login")
    print("📝 Register Endpoint: http://localhost:8001/api/auth/register")
    print("👤 Demo Credentials:")
    print("   Email: demo@uternity.com")
    print("   Password: demo123")
    print("   ---")
    print("   Email: admin@uternity.com") 
    print("   Password: admin123")
    
    uvicorn.run(
        "simple_auth_service:app",
        host="0.0.0.0",
        port=8001,
        reload=False,
        log_level="info"
    )
