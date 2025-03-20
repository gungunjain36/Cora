# FastAPI app
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import uvicorn
from routes.agent_routes import router as agent_router
from routes.user_routes import router as user_router
from routes.session_routes import router as session_router

# Create FastAPI instance
app = FastAPI(
    title="Cora Insurance API",
    description="Backend API for Cora Insurance",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Include routers
app.include_router(agent_router)
app.include_router(user_router)
app.include_router(session_router)

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Welcome to the Cora Insurance API"}

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Run the application
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
