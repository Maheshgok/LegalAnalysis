from pydantic import BaseModel, Field
from typing import List

class InitialAnalysisResult(BaseModel):
    suggested_party_a: List[str] = Field(default=[], description="List of parties suggested for side A (e.g., Petitioners)")
    suggested_party_b: List[str] = Field(default=[], description="List of parties suggested for side B (e.g., Respondents)")
    unassigned_entities: List[str] = Field(default=[], description="List of unassigned or ambiguous entities")
    phase_1: str = Field(..., description="Raw Fact Extraction")
    phase_2: str = Field(..., description="Narrative Mapping")
    phase_3: str = Field(..., description="Objective Formalization")
    phase_4: str = Field(..., description="Regulatory Mapping")

class StrategyAnalysisRequest(BaseModel):
    phase_3: str = Field(..., description="Objective Formalization")
    phase_4: str = Field(..., description="Regulatory Mapping")
    party_a: str = Field(..., description="Selected Party A")
    party_b: str = Field(..., description="Selected Party B")
    provider: str = Field("openai", description="The AI provider to use ('openai' or 'google')")

class StrategyAnalysisResult(BaseModel):
    phase_5: str = Field(..., description="Critical Vulnerability Analysis")
    phase_6: str = Field(..., description="Adversarial Strategy")
    search_terms: str = Field(..., description="10 suggested precedent search terms")

class PrecedentAnalysisResult(BaseModel):
    phase_7: str = Field(..., description="Precedent Matching")

class InitialAnalysisRequest(BaseModel):
    document_text: str = Field(..., description="The combined text extracted from all uploaded documents")
    provider: str = Field("openai", description="The AI provider to use ('openai' or 'google')")

class PrecedentRequest(BaseModel):
    phase_6: str = Field(..., description="The output from phase 6 to build upon")
    case_law_context: str = Field(..., description="User provided case law context")
    provider: str = Field("openai", description="The AI provider to use ('openai' or 'google')")
