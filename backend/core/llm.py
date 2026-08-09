try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    genai = None
    types = None

from backend.core.config import config
from backend.schemas.food import MealEntry
from backend.schemas.catalog import SupplementEstimate

# It relies on GOOGLE_API_KEY in the environment if api_key is not passed,
# but we explicitly pass it for clarity if configured.
client = None
if GENAI_AVAILABLE:
    client_kwargs = {}
    if config.GEMINI_API_KEY:
        client_kwargs['api_key'] = config.GEMINI_API_KEY
    try:
        client = genai.Client(**client_kwargs)
    except Exception as e:
        print(f"Warning: Failed to initialize Gemini client: {e}")
        GENAI_AVAILABLE = False

def extract_macros_from_text(text: str) -> MealEntry:
    """
    Takes a natural language description of a meal and returns structured
    macro and ingredient information using Gemini.
    Falls back to mock data if Gemini is not available.
    """
    if not GENAI_AVAILABLE or client is None:
        # Fallback mock for testing
        return MealEntry(
            name="Mocked: " + text[:20],
            description=text,
            ingredients=["ingredient 1", "ingredient 2"],
            macros={
                "calories": 500,
                "protein": 20,
                "carbs": 60,
                "fat": 15,
                "fiber": 5,
                "sugar": 10,
            },
            micros={},
        )

    prompt = f"""
    You are an expert nutrition AI. The user has provided a description of what they ate.
    Your task is to estimate the macronutrients, breakdown the ingredients, and estimate
    the micronutrients (Vitamins/Minerals based on D-A-CH references).
    Provide realistic, average nutritional values. If amounts aren't specified, assume standard portion sizes.

    User Input:
    {text}
    """

    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=MealEntry,
        ),
    )

    return MealEntry.model_validate_json(response.text)


def estimate_supplement_from_text(description: str) -> SupplementEstimate:
    """
    Takes a free-text description of a supplement and returns structured
    catalog data (name, unit, default dose, time of day) using Gemini.
    Falls back to mock data if Gemini is not available.
    """
    if not GENAI_AVAILABLE or client is None:
        # Fallback mock for testing
        return SupplementEstimate(
            name=description[:30],
            unit="mg",
            default_dose=500,
            default_time_of_day="morning",
        )

    prompt = f"""
    Du bist Ernährungsexperte. Analysiere die folgende Supplement-Beschreibung
    und schätze Name, Einheit, übliche Einzeldosis und Einnahmezeitpunkt.

    Supplement:
    {description}
    """

    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=SupplementEstimate,
        ),
    )

    return SupplementEstimate.model_validate_json(response.text)
