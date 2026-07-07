import requests
import json

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "llama3.2:3b"

TONE_INSTRUCTIONS = {
    "warm": "Write like a warm, encouraging friend who happens to be a great listener.",
    "clinical": "Write in a neutral, precise, observational tone.",
    "concise": "Write in the fewest words possible, no filler.",
}

def analyze_entry(content: str, tone: str = "warm") -> dict:
    tone_instruction = TONE_INSTRUCTIONS.get(tone, TONE_INSTRUCTIONS["warm"])
    prompt = f"""Analyze this journal entry and respond ONLY with valid JSON, no other text.
{tone_instruction}

Format: {{
  "mood": "one word mood",
  "tags": "comma,separated,tags"
}}

Journal entry: {content}
"""
    response = requests.post(OLLAMA_URL, json={
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json"
    })
    result = response.json()
    try:
        parsed = json.loads(result["response"])
        return parsed
    except (json.JSONDecodeError, KeyError):
        return {"mood": "unknown", "tags": ""}


ACTION_PROMPTS = {
    "coach": "You are a warm, encouraging coach. Read this journal entry and give one paragraph of supportive coaching: validate the emotion, then offer one concrete next step.",
    "summarize": "Summarize this journal entry in 2-3 sentences, capturing the key events and feelings.",
    "followup": "Read this journal entry and write 3 thoughtful follow-up questions that would help the person reflect more deeply. Return them as a numbered list.",
    "suggest": "Read this journal entry and suggest 2-3 small, concrete actions or ideas related to what they wrote about.",
}

def run_coach_action(content: str, action_type: str) -> str:
    instruction = ACTION_PROMPTS.get(action_type)
    if not instruction:
        raise ValueError(f"Unknown action_type: {action_type}")

    prompt = f"""{instruction}

Journal entry: {content}

Respond with plain text only, no JSON, no preamble."""

    response = requests.post(OLLAMA_URL, json={
        "model": MODEL,
        "prompt": prompt,
        "stream": False
    })
    result = response.json()
    return result.get("response", "").strip()


def generate_review_summary(entries_text: str, period_label: str, tone: str = "warm") -> str:
    tone_instruction = TONE_INSTRUCTIONS.get(tone, TONE_INSTRUCTIONS["warm"])
    prompt = f"""{tone_instruction}

You are reviewing a collection of journal entries from {period_label}.
Write a reflective review covering: recurring themes, the emotional arc across
the period, and one encouraging, specific observation about growth or a pattern
worth noticing. Keep it to 3-4 short paragraphs, plain text, no preamble.

JOURNAL ENTRIES:
{entries_text}
"""
    response = requests.post(OLLAMA_URL, json={
        "model": MODEL,
        "prompt": prompt,
        "stream": False
    })
    result = response.json()
    return result.get("response", "").strip()


def answer_journal_question(entries_context: str, question: str) -> str:
    prompt = f"""Based on these journal entries:

{entries_context}

Answer the question: {question}

Use only information supported by the entries above. If the entries don't contain enough information, say so honestly. Respond in plain text, no JSON, no preamble."""

    response = requests.post(OLLAMA_URL, json={
        "model": MODEL,
        "prompt": prompt,
        "stream": False
    })
    result = response.json()
    return result.get("response", "").strip()
