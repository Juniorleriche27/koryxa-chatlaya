from __future__ import annotations

from datetime import datetime
from typing import Any, List, Literal

from pydantic import BaseModel, Field, field_validator


AssistantMode = Literal["general", "launch_structure_sell"]

PROBLEM_REPORT_DOMAINS = (
    {"id": "employment", "label": "Emploi"},
    {"id": "training", "label": "Formation"},
    {"id": "agriculture", "label": "Agriculture"},
    {"id": "healthcare", "label": "Santé"},
    {"id": "education", "label": "Éducation"},
    {"id": "transport", "label": "Transport"},
    {"id": "water_access", "label": "Accès à l'eau"},
    {"id": "electricity", "label": "Électricité"},
    {"id": "commerce", "label": "Commerce"},
    {"id": "financing", "label": "Financement"},
    {"id": "entrepreneurship", "label": "Entrepreneuriat"},
    {"id": "environment", "label": "Environnement"},
    {"id": "administration", "label": "Administration et services publics"},
    {"id": "digital_access", "label": "Accès numérique"},
    {"id": "housing", "label": "Logement"},
    {"id": "food_security", "label": "Sécurité alimentaire"},
    {"id": "other", "label": "Autre"},
)

PROBLEM_REPORT_ZONE_TYPES = (
    {"id": "urban", "label": "Grande ville / zone urbaine"},
    {"id": "peri_urban", "label": "Zone périurbaine"},
    {"id": "rural", "label": "Zone rurale"},
    {"id": "village", "label": "Village"},
    {"id": "unknown", "label": "Je ne sais pas"},
)

PROBLEM_REPORT_SEVERITIES = (
    {"id": "low", "label": "Faible"},
    {"id": "medium", "label": "Moyen"},
    {"id": "high", "label": "Grave"},
    {"id": "critical", "label": "Très urgent"},
)

PROBLEM_REPORT_FREQUENCIES = (
    {"id": "one_off", "label": "Ponctuel"},
    {"id": "occasional", "label": "Occasionnel"},
    {"id": "weekly", "label": "Fréquent"},
    {"id": "daily", "label": "Chaque jour"},
    {"id": "constant", "label": "Permanent"},
    {"id": "seasonal", "label": "Saisonnier"},
)

PROBLEM_REPORT_EVIDENCE_TYPES = (
    {"id": "observation", "label": "Observation personnelle"},
    {"id": "community_testimony", "label": "Témoignage communautaire"},
    {"id": "photo", "label": "Photo"},
    {"id": "document", "label": "Document"},
    {"id": "estimate", "label": "Estimation personnelle"},
    {"id": "none", "label": "Aucune preuve pour le moment"},
)

PROBLEM_REPORT_DOMAIN_IDS = frozenset(item["id"] for item in PROBLEM_REPORT_DOMAINS)
PROBLEM_REPORT_ZONE_TYPE_IDS = frozenset(item["id"] for item in PROBLEM_REPORT_ZONE_TYPES)
PROBLEM_REPORT_SEVERITY_IDS = frozenset(item["id"] for item in PROBLEM_REPORT_SEVERITIES)
PROBLEM_REPORT_FREQUENCY_IDS = frozenset(item["id"] for item in PROBLEM_REPORT_FREQUENCIES)
PROBLEM_REPORT_EVIDENCE_TYPE_IDS = frozenset(item["id"] for item in PROBLEM_REPORT_EVIDENCE_TYPES)


class ConversationResponse(BaseModel):
    conversation_id: str
    title: str
    created_at: datetime
    updated_at: datetime
    archived: bool = False
    assistant_mode: AssistantMode = "general"


class ConversationListResponse(BaseModel):
    items: List[ConversationResponse]
    page: int
    limit: int


class ChatMessagePayload(BaseModel):
    conversation_id: str
    message: str = Field(..., min_length=1, max_length=12000)


class ConversationUpdatePayload(BaseModel):
    assistant_mode: AssistantMode


class ChatMessageItem(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime


class MessagesResponse(BaseModel):
    items: List[ChatMessageItem]


class ProblemReportCategoryItem(BaseModel):
    id: str
    label: str


class ProblemReportCategoriesResponse(BaseModel):
    domains: List[ProblemReportCategoryItem]
    zone_types: List[ProblemReportCategoryItem]
    severities: List[ProblemReportCategoryItem]
    frequencies: List[ProblemReportCategoryItem]
    evidence_types: List[ProblemReportCategoryItem]


class ProblemReportCreatePayload(BaseModel):
    conversation_id: str | None = None
    message_id: str | None = None
    country: str = Field(..., min_length=1, max_length=120)
    region: str | None = Field(default=None, max_length=120)
    city: str | None = Field(default=None, max_length=120)
    commune: str | None = Field(default=None, max_length=120)
    zone_type: str | None = None
    domain: str
    sector: str | None = Field(default=None, max_length=120)
    problem_title: str | None = Field(default=None, max_length=200)
    problem_description: str = Field(..., min_length=20, max_length=5000)
    affected_population: str | None = Field(default=None, max_length=500)
    severity: str | None = None
    frequency: str | None = None
    perceived_cause: str | None = Field(default=None, max_length=2000)
    proposed_solution: str | None = Field(default=None, max_length=2000)
    evidence_type: str | None = None
    consent_anonymized: bool = False
    source_channel: str = Field(default="chatlaya_web", max_length=80)
    raw_payload: dict[str, Any] = Field(default_factory=dict)

    @field_validator(
        "country",
        "region",
        "city",
        "commune",
        "sector",
        "problem_title",
        "problem_description",
        "affected_population",
        "perceived_cause",
        "proposed_solution",
        "source_channel",
        mode="before",
    )
    @classmethod
    def strip_string_fields(cls, value: Any) -> Any:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("country")
    @classmethod
    def validate_country(cls, value: str | None) -> str:
        if not value:
            raise ValueError("country is required")
        return value

    @field_validator("problem_description")
    @classmethod
    def validate_problem_description(cls, value: str | None) -> str:
        if not value:
            raise ValueError("problem_description is required")
        return value

    @field_validator("domain")
    @classmethod
    def validate_domain(cls, value: str) -> str:
        clean = (value or "").strip()
        if clean not in PROBLEM_REPORT_DOMAIN_IDS:
            raise ValueError("domain is invalid")
        return clean

    @field_validator("zone_type")
    @classmethod
    def validate_zone_type(cls, value: str | None) -> str | None:
        if value is None:
            return None
        clean = value.strip()
        if clean not in PROBLEM_REPORT_ZONE_TYPE_IDS:
            raise ValueError("zone_type is invalid")
        return clean

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, value: str | None) -> str | None:
        if value is None:
            return None
        clean = value.strip()
        if clean not in PROBLEM_REPORT_SEVERITY_IDS:
            raise ValueError("severity is invalid")
        return clean

    @field_validator("frequency")
    @classmethod
    def validate_frequency(cls, value: str | None) -> str | None:
        if value is None:
            return None
        clean = value.strip()
        if clean not in PROBLEM_REPORT_FREQUENCY_IDS:
            raise ValueError("frequency is invalid")
        return clean

    @field_validator("evidence_type")
    @classmethod
    def validate_evidence_type(cls, value: str | None) -> str | None:
        if value is None:
            return None
        clean = value.strip()
        if clean not in PROBLEM_REPORT_EVIDENCE_TYPE_IDS:
            raise ValueError("evidence_type is invalid")
        return clean

    @field_validator("raw_payload")
    @classmethod
    def validate_raw_payload(cls, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise ValueError("raw_payload must be an object")
        return value


class ProblemReportResponse(BaseModel):
    id: str
    conversation_id: str | None = None
    message_id: str | None = None
    country: str
    region: str | None = None
    city: str | None = None
    commune: str | None = None
    zone_type: str | None = None
    domain: str
    sector: str | None = None
    problem_title: str | None = None
    problem_description: str
    affected_population: str | None = None
    severity: str | None = None
    frequency: str | None = None
    perceived_cause: str | None = None
    proposed_solution: str | None = None
    evidence_type: str | None = None
    consent_anonymized: bool = False
    source_channel: str
    raw_payload: dict[str, Any]
    status: str
    created_at: datetime
    updated_at: datetime
