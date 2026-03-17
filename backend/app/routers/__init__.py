"""
Routers package for Double Agent backend API.

This package contains all FastAPI routers for the application.
"""

from fastapi import APIRouter

from .sessions import router as sessions_router
from .debate import router as debate_router
from .config import router as config_router
from .messages import router as messages_router

# Main API router
api_router = APIRouter(prefix="/api")

# Include sub-routers
api_router.include_router(sessions_router, prefix="/sessions", tags=["sessions"])
api_router.include_router(debate_router, prefix="/debate", tags=["debate"])
api_router.include_router(config_router, prefix="/config", tags=["config"])
api_router.include_router(messages_router, prefix="/messages", tags=["messages"])

__all__ = ["api_router", "sessions_router", "debate_router", "config_router", "messages_router"]
