from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from routes.blockchain_routes import router as blockchain_router

# Create FastAPI instance
app = FastAPI(
    title="Cora Insurance API - Test Mode",
    description="Simplified backend API for Cora Insurance for testing blockchain functionality",
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

# Include only blockchain router
app.include_router(blockchain_router)

# Root endpoint
@app.get("/")
async def root():
    return {"message": "Welcome to the Cora Insurance API - Test Mode"}

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "mode": "test"}

# Run the application
if __name__ == "__main__":
    uvicorn.run("simple_server:app", host="0.0.0.0", port=8000, reload=True) 