"""Pydantic request/response models for StyleAI backend.

Note: most endpoints derive user_id from the auth token (Depends(current_user))
rather than the request body. The user_id field on these models is kept for
back-compat but is ignored / overridden server-side.
"""
from pydantic import BaseModel, Field
from typing import Optional, List


# ─────────────────────────── TRY-ON ─────────────────────────── #

class TryOnRequest(BaseModel):
    wardrobe_item_id: Optional[str] = None
    item_image_url: str
    avatar_selfie_url: str
    item_name: str
    item_category: str = "tops"
    model: str = "gen4_image_turbo"


class MultiItemTryOnRequest(BaseModel):
    avatar_selfie_url: str
    items: List[dict] = Field(
        ...,
        description="List of {image_url, name, category} dicts. Max 2."
    )
    model: str = "gen4_image_turbo"


class EventSceneRequest(BaseModel):
    tryon_result_url: str
    event_context: str
    tryon_result_id: Optional[str] = None


class AnimateRequest(BaseModel):
    image_url: str
    motion_prompt: str = "Person slowly turning, confident fashion model pose, smooth movement"
    tryon_result_id: Optional[str] = None


# ─────────────────────────── WARDROBE ─────────────────────────── #

class AddWardrobeFromUrl(BaseModel):
    name: str
    category: str
    image_url: str
    occasion: Optional[str] = "casual"
    color: Optional[str] = None
    brand: Optional[str] = None
    source_url: Optional[str] = None
    tags: List[str] = []
    clean: Optional[str] = "none"  # "auto" | "runway" | "rembg" | "none"


class ScrapeRequest(BaseModel):
    url: str


class ScrapeResponse(BaseModel):
    image_url: str
    name: str
    source_url: str
    suggested_category: Optional[str] = None


# ─────────────────────────── OUTFITS ─────────────────────────── #

class SaveOutfit(BaseModel):
    name: str
    item_ids: List[str]
    occasion: Optional[str] = None
    preview_image_url: Optional[str] = None
    notes: Optional[str] = None


# ─────────────────────────── AVATAR ─────────────────────────── #

class CreateCharacterRequest(BaseModel):
    selfie_url: str
    name: str = "My Stylist"
    voice: Optional[str] = None


class SyncKnowledgeRequest(BaseModel):
    pass  # user inferred from auth


# ─────────────────────────── STYLIST CHAT ─────────────────────────── #

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class StylistChatRequest(BaseModel):
    messages: List[ChatMessage]


class StylistChatResponse(BaseModel):
    reply: str
    suggested_item_ids: List[str] = []


# ─────────────────────────── FRIENDS / CHAT ─────────────────────────── #

class FriendSearchResult(BaseModel):
    id: str
    full_name: Optional[str]
    email: Optional[str]
    username: Optional[str]
    share_code: str
    relationship: Optional[str] = None  # "friend" | "request_sent" | "request_received" | None


class SendFriendRequest(BaseModel):
    addressee_id: str


class RespondFriendRequest(BaseModel):
    friendship_id: str
    accept: bool


class SendMessageRequest(BaseModel):
    recipient_id: str
    content: Optional[str] = None
    shared_outfit_id: Optional[str] = None
    shared_tryon_id: Optional[str] = None
    shared_image_url: Optional[str] = None
    shared_caption: Optional[str] = None
