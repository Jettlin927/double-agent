"""
Configuration API routes for Double Agent backend.

Provides endpoints for retrieving:
- Available model presets
- Available role presets
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, status

from ..schemas.agent import (
    ModelPreset,
    RoleDefinition,
    AgentPersonality,
    get_all_model_presets,
    get_presets_by_provider,
    get_preset_by_id,
    get_all_roles,
    get_roles_by_personality,
    get_role_by_id,
)

router = APIRouter()


@router.get("/models")
async def get_models() -> dict:
    """
    Get all supported model presets.

    Returns:
        Dictionary with all models and models grouped by provider
    """
    try:
        all_presets = get_all_model_presets()
        by_provider = get_presets_by_provider()

        # Convert to dictionaries for JSON response
        all_models = [preset.model_dump(by_alias=True) for preset in all_presets]
        grouped_models = {
            provider: [preset.model_dump(by_alias=True) for preset in presets]
            for provider, presets in by_provider.items()
        }

        return {
            "models": all_models,
            "by_provider": grouped_models,
            "total": len(all_models),
            "providers": list(by_provider.keys())
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get model presets: {str(e)}"
        )


@router.get("/models/{preset_id}")
async def get_model(preset_id: str) -> dict:
    """
    Get a specific model preset by ID.

    Args:
        preset_id: Model preset identifier

    Returns:
        Model preset details
    """
    try:
        preset = get_preset_by_id(preset_id)

        if not preset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Model preset not found: {preset_id}"
            )

        return {
            "model": preset.model_dump(by_alias=True)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get model preset: {str(e)}"
        )


@router.get("/roles")
async def get_roles(
    personality: Optional[AgentPersonality] = None
) -> dict:
    """
    Get all available role presets.

    Args:
        personality: Filter by personality type (gentle/angry)

    Returns:
        Dictionary with role presets
    """
    try:
        if personality:
            roles = get_roles_by_personality(personality)
        else:
            roles = get_all_roles()

        # Convert to dictionaries
        all_roles = [role.model_dump(by_alias=True) for role in roles]

        # Group by personality
        gentle_roles = [
            role.model_dump(by_alias=True)
            for role in roles
            if role.personality == AgentPersonality.GENTLE
        ]
        angry_roles = [
            role.model_dump(by_alias=True)
            for role in roles
            if role.personality == AgentPersonality.ANGRY
        ]

        return {
            "roles": all_roles,
            "gentle": gentle_roles,
            "angry": angry_roles,
            "total": len(all_roles),
            "filter": personality.value if personality else None
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get role presets: {str(e)}"
        )


@router.get("/roles/{role_id}")
async def get_role(role_id: str) -> dict:
    """
    Get a specific role preset by ID.

    Args:
        role_id: Role preset identifier

    Returns:
        Role preset details
    """
    try:
        role = get_role_by_id(role_id)

        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Role preset not found: {role_id}"
            )

        return {
            "role": role.model_dump(by_alias=True)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get role preset: {str(e)}"
        )


@router.get("/providers")
async def get_providers() -> dict:
    """
    Get all available model providers.

    Returns:
        List of provider names
    """
    try:
        by_provider = get_presets_by_provider()
        providers = list(by_provider.keys())

        # Add provider details
        provider_details = []
        for provider, presets in by_provider.items():
            api_types = list(set(preset.api_type.value for preset in presets))
            provider_details.append({
                "name": provider,
                "model_count": len(presets),
                "api_types": api_types,
                "models": [preset.model for preset in presets]
            })

        return {
            "providers": providers,
            "details": provider_details,
            "total": len(providers)
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get providers: {str(e)}"
        )
