import httpx

def get_embedding(text: str) -> list[float]:
    with httpx.Client(timeout=60.0) as client:
        resp = client.post(
            "http://localhost:11434/api/embeddings",
            json={"model": "nomic-embed-text", "prompt": text}
        )
        resp.raise_for_status()
        return resp.json()["embedding"]
