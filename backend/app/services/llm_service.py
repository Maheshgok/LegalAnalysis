from openai import AsyncOpenAI
import vertexai
from vertexai.generative_models import GenerativeModel
import logging
from fastapi import HTTPException
from app.core.config import settings
import json
from app.models.schemas import InitialAnalysisResult, PrecedentAnalysisResult, StrategyAnalysisResult

# Initialize OpenAI
if not settings.OPENAI_API_KEY:
    logging.warning("OPENAI_API_KEY is not set. OpenAI calls will fail.")
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

# Initialize Vertex AI lazily
_gemini_model = None

def get_gemini_model():
    global _gemini_model
    if not _gemini_model:
        try:
            vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_LOCATION)
            _gemini_model = GenerativeModel("gemini-1.5-flash-001")
        except Exception as e:
            logging.error(f"Failed to initialize Vertex AI Gemini model: {e}")
            raise HTTPException(status_code=500, detail="Google Cloud AI is unavailable. Check credentials and Project ID.")
    return _gemini_model

SYSTEM_PROMPT = """You are an expert Legal Assistant. Your role is to objectively analyze and contextualize legal documents for the parties involved based solely on the facts presented. 
IMPORTANT: If a document contains multiple distinct disputes (even within the same project), you must explicitly identify them and treat them as completely separate issues in your analysis. Do not conflate the facts or laws of one dispute with another.
CRITICAL RULE: Omit historical grievances, general known facts, or tangential disagreements that are not the central focus of the active, primary dispute(s) being litigated or argued in these specific documents."""

PROMPT_PHASE_1 = """
Review the provided documents. Extract all objective facts, dates, names, and key events. Group these facts into logical, chronological categories (e.g., Original Contracts, Disputed Events, Legal Actions). 

STRICT CONSTRAINT: If there are multiple distinct disputes in the text, explicitly separate them into distinct sections. Focus on the relevant legal disputes and ignore boilerplate generic text. Do not hallucinate facts.

Document Context:
{document_text}
"""

PROMPT_PHASE_2 = """
Based on the extracted facts, tell the story of this dispute. Clearly separate the facts into three buckets: 1) What both parties agree on, 2) The core contentions (what they are fighting over), and 3) The current status quo or latest ruling.

Raw Facts Context:
{phase_1}
"""

PROMPT_PHASE_3 = """
Rewrite this dispute as a formal, neutral case summary from the perspective of an independent legal observer. Use appropriate professional terminology. Structure it with sections for Background, Genesis of the Dispute, Contentions of Party A, Contentions of Party B, and Final Findings.

Narrative Context:
{phase_2}
"""

PROMPT_PHASE_4 = """
Identify the legal and regulatory frameworks governing this case. Break this down into: 1) Statutory Laws (government acts/regulations), 2) Internal/Governing Documents (contracts, deeds, bylaws), and 3) Evidentiary or Procedural rules that dictate how this dispute must be handled.

STRICT CONSTRAINT: Only list frameworks, terms, and regulations that are STRICTLY RELEVANT to the core contention of this specific case. Do not generate generic lists of laws. If a law is not directly impactful to the specific point of dispute, omit it.

Case Summary Context:
{phase_3}
"""

PROMPT_EXTRACT_PARTIES = """
Analyze the provided legal document and identify the primary opposing legal entities (litigants, disputing parties) involved in the core dispute.
Focus on identifying who is bringing the action (e.g., Petitioner, Appellant, Claimant, Contractor) and who is defending or opposing it (e.g., Respondent, Defendant, Authority, Employer).
DO NOT just list every named entity or organization mentioned in the text.
If a party is a government body acting through a specific officer or department (e.g., "Government of Maharashtra, Department of Revenue, Tehsildar - Khandala"), group them together as a single unified party string.

Logically group the identified entities into the two opposing sides. Any ambiguous entities or distinct third parties should be placed into an unassigned pool.
Return ONLY a valid JSON object with EXACTLY the following three keys: "party_a", "party_b", and "unassigned". Each key must contain a list of strings representing the names of those entities.
For example: {{"party_a": ["M/s Contractor Private Limited"], "party_b": ["Government of Maharashtra through Tehsildar Khandala"], "unassigned": ["XYZ Bank"]}}. Do not include any other text or markdown.
Document Context:
{document_text}
"""

PROMPT_PHASE_5 = """
Conduct a critical legal analysis of this case. What are the specific strengths and weaknesses of {party_a}'s claims? What are the strengths and weaknesses of {party_b}'s claims? Finally, identify any logical gaps, ignored evidence, or vulnerabilities in the final judgment that could be exploited in an appeal.

STRICT CONSTRAINT: Base your analysis EXCLUSIVELY on the core dispute facts provided. Do not invent arguments, weaknesses, or vulnerabilities that do not stem directly from the text. Keep the analysis laser-focused on the single main point of contention.

Case Summary Context:
{phase_3}
Regulatory Context:
{phase_4}
"""

PROMPT_PHASE_6 = """
Assume this case is moving to a higher appellate court or formal mediation. Build a simple, fact-based presentation outline for {party_a} and {party_b}. For each presentation, state the primary objective and provide 3-4 key pillars of argument, focusing on their strongest legal and factual points.

Vulnerability Analysis Context:
{phase_5}
"""

PROMPT_SEARCH_TERMS = """
Based on the regulatory context and the case summary, generate the 10 most relevant search terms to be used on the Supreme Court and High Court websites for precedent search.
For laws, explicitly mention the relevant dates for each law (e.g., last amendment which may be relevant, as precedents before the amendment may not hold).
The rest should be specific factual or legal search terms (keywords) highly tailored to this dispute.

Case Summary Context:
{phase_3}
Regulatory Context:
{phase_4}
"""

PROMPT_SUMMARIZE_PRECEDENT = """
Extract the most relevant sections of the following precedent case law. Focus ONLY on the judgement, its narration, the reasons given by the judge, and the specific circumstances of the judgement. Do not include the full case details or irrelevant historical context. Keep it concise to save tokens while retaining the critical legal findings.

Precedent Document:
{document_text}
"""

PROMPT_PHASE_7 = """
Identify the established legal doctrines and types of precedents that each side would rely on if this case is appealed. Use the provided "Case Law Context" to map these specific precedents to the facts of this case. Explain how the provided cases govern the outcome.

Case Law Context (Provided by User):
{case_law_context}

Strategy Outline Context:
{phase_6}
"""

async def generate_response(prompt: str, provider: str, temperature: float = 0.2) -> str:
    try:
        if provider == "google":
            model = get_gemini_model()
            resp = await model.generate_content_async(
                f"{SYSTEM_PROMPT}\n\n{prompt}",
                generation_config={"temperature": temperature}
            )
            return resp.text
        else:
            if not settings.OPENAI_API_KEY:
                raise HTTPException(status_code=401, detail="OpenAI API Key is missing. Please configure it in .env.")
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature
            )
            return resp.choices[0].message.content
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"LLM Generation failed for provider '{provider}': {e}")
        raise HTTPException(status_code=502, detail=f"AI Provider ({provider}) failed to generate a response: {e}")

async def run_initial_analysis(document_text: str, provider: str = "openai") -> InitialAnalysisResult:
    try:
        phase_1 = await generate_response(PROMPT_PHASE_1.format(document_text=document_text), provider, 0.2)
        phase_2 = await generate_response(PROMPT_PHASE_2.format(phase_1=phase_1), provider, 0.2)
        phase_3 = await generate_response(PROMPT_PHASE_3.format(phase_2=phase_2), provider, 0.2)
        phase_4 = await generate_response(PROMPT_PHASE_4.format(phase_3=phase_3), provider, 0.2)
        
        parties_json_str = await generate_response(PROMPT_EXTRACT_PARTIES.format(document_text=document_text), provider, 0.1)
        
        suggested_party_a = []
        suggested_party_b = []
        unassigned_entities = []
        try:
            cleaned_str = parties_json_str.strip()
            if cleaned_str.startswith("```json"):
                cleaned_str = cleaned_str[7:]
            if cleaned_str.startswith("```"):
                cleaned_str = cleaned_str[3:]
            if cleaned_str.endswith("```"):
                cleaned_str = cleaned_str[:-3]
            extracted_parties_dict = json.loads(cleaned_str.strip())
            if isinstance(extracted_parties_dict, dict):
                suggested_party_a = extracted_parties_dict.get("party_a", [])
                suggested_party_b = extracted_parties_dict.get("party_b", [])
                unassigned_entities = extracted_parties_dict.get("unassigned", [])
        except Exception as e:
            logging.error(f"Failed to parse extracted parties dict: {e}")

        return InitialAnalysisResult(
            suggested_party_a=suggested_party_a,
            suggested_party_b=suggested_party_b,
            unassigned_entities=unassigned_entities,
            phase_1=phase_1, phase_2=phase_2, phase_3=phase_3, phase_4=phase_4
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Initial Analysis Pipeline failed: {str(e)}")

async def run_strategy_analysis(phase_3: str, phase_4: str, party_a: str, party_b: str, provider: str = "openai") -> StrategyAnalysisResult:
    try:
        phase_5 = await generate_response(PROMPT_PHASE_5.format(phase_3=phase_3, phase_4=phase_4, party_a=party_a, party_b=party_b), provider, 0.3)
        phase_6 = await generate_response(PROMPT_PHASE_6.format(phase_5=phase_5, party_a=party_a, party_b=party_b), provider, 0.3)
        search_terms = await generate_response(PROMPT_SEARCH_TERMS.format(phase_3=phase_3, phase_4=phase_4), provider, 0.3)
        
        return StrategyAnalysisResult(phase_5=phase_5, phase_6=phase_6, search_terms=search_terms)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Strategy Analysis Pipeline failed: {str(e)}")

async def run_precedent_analysis(phase_6: str, case_law_context: str, provider: str = "openai") -> PrecedentAnalysisResult:
    try:
        c_context = case_law_context if case_law_context.strip() else "No specific case law provided. Rely on general established legal doctrines."
        phase_7 = await generate_response(PROMPT_PHASE_7.format(phase_6=phase_6, case_law_context=c_context), provider, 0.3)
        return PrecedentAnalysisResult(phase_7=phase_7)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Precedent Analysis Pipeline failed: {str(e)}")

async def summarize_precedent_document(document_text: str, provider: str = "openai") -> str:
    try:
        summary = await generate_response(PROMPT_SUMMARIZE_PRECEDENT.format(document_text=document_text), provider, 0.2)
        return summary
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Precedent Summarization failed: {str(e)}")
