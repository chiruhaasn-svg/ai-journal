import requests
import json

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "llama3.2:3b"

def analyze_entry(content: str) -> dict:
    prompt = f"""Analyze this journal entry and respond ONLY with valid JSON, no other text.
Format: {{"mood": "one word mood", "summary": "one sentence summary", "tags": "comma,separated,tags"}}

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
        return {"mood": "unknown", "summary": "", "tags": ""}