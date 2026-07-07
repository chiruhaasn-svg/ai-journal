import os
import tempfile
from fastapi import APIRouter, UploadFile, File, HTTPException
from starlette.concurrency import run_in_threadpool

router = APIRouter()

# tiny.en = fast (~1-2s on M1), base.en = more accurate but slower
WHISPER_MODEL = "mlx-community/whisper-tiny.en-mlx"


def _transcribe_file(path: str) -> str:
    import mlx_whisper

    result = mlx_whisper.transcribe(
        path,
        path_or_hf_repo=WHISPER_MODEL,
        language="en",
    )
    return result["text"].strip()


@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    if not file.filename and not file.content_type:
        raise HTTPException(status_code=400, detail="No audio file provided")

    suffix = os.path.splitext(file.filename or "recording.webm")[1] or ".webm"
    tmp_path = None
    try:
        contents = await file.read()
        if len(contents) < 500:
            raise HTTPException(status_code=400, detail="Audio file too short or empty")

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        text = await run_in_threadpool(_transcribe_file, tmp_path)
        return {"text": text}
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="mlx-whisper not installed. Run: pip install mlx-whisper",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
