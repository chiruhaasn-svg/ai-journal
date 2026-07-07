import { useState, useRef, useEffect } from "react";

const API_URL = "http://localhost:8000";

function MicIcon() {
  return (
    <svg className="mic-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" fill="currentColor" />
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="currentColor" />
    </svg>
  );
}

function pickMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

function fileNameForMime(mime) {
  if (mime.includes("mp4")) return "recording.m4a";
  if (mime.includes("ogg")) return "recording.ogg";
  return "recording.webm";
}

export default function VoiceInput({ onTranscript }) {
  const [status, setStatus] = useState("idle"); // idle | recording | transcribing
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const mimeRef = useRef("audio/webm");

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      releaseStream();
    };
  }, []);

  const transcribeBlob = async (blob) => {
    setStatus("transcribing");
    try {
      const formData = new FormData();
      formData.append("file", blob, fileNameForMime(blob.type));

      const res = await fetch(`${API_URL}/transcribe`, { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || "Transcription failed");
      }

      const text = (data.text || "").trim();
      if (text) {
        onTranscript(text);
      } else {
        alert("No speech detected. Try speaking a bit longer and closer to the mic.");
      }
    } catch (err) {
      alert(err.message || "Could not transcribe. Check that the backend is running.");
    } finally {
      setStatus("idle");
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Microphone is not available in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickMimeType();
      mimeRef.current = mimeType || "audio/webm";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        releaseStream();
        recorderRef.current = null;

        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        chunksRef.current = [];

        if (blob.size < 500) {
          setStatus("idle");
          alert("No audio captured. Check mic permission and try again.");
          return;
        }

        transcribeBlob(blob);
      };

      recorder.onerror = () => {
        releaseStream();
        recorderRef.current = null;
        chunksRef.current = [];
        setStatus("idle");
        alert("Recording failed. Please try again.");
      };

      // Collect audio in 250ms chunks so nothing is lost on stop
      recorder.start(250);
      recorderRef.current = recorder;
      setStatus("recording");
    } catch {
      releaseStream();
      alert("Microphone blocked. Allow mic access for localhost in browser settings.");
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;

    setStatus("transcribing");
    try {
      recorder.requestData();
      recorder.stop();
    } catch {
      releaseStream();
      recorderRef.current = null;
      chunksRef.current = [];
      setStatus("idle");
      alert("Could not stop recording. Please try again.");
    }
  };

  const handleClick = () => {
    if (status === "transcribing") return;
    if (status === "recording") {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const label =
    status === "recording"
      ? "Recording… click to stop"
      : status === "transcribing"
        ? "Transcribing…"
        : null;

  return (
    <div className="mic-controls">
      <button
        type="button"
        className={`mic-btn${status === "recording" ? " listening" : ""}${status === "transcribing" ? " transcribing" : ""}`}
        onClick={handleClick}
        disabled={status === "transcribing"}
        title={
          status === "recording"
            ? "Stop and transcribe"
            : status === "transcribing"
              ? "Transcribing locally…"
              : "Click to record voice"
        }
        aria-label={status === "recording" ? "Stop recording" : "Start voice input"}
      >
        <MicIcon />
      </button>
      {label && <span className="recording-label">{label}</span>}
    </div>
  );
}
