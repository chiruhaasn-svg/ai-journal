import { useState, useEffect } from "react";

const API_BASE = "http://localhost:8000";

export default function Login({ onAuthenticated }) {
  const [mode, setMode] = useState("loading"); // loading | setup | login
  const [error, setError] = useState("");

  // Setup state
  const [setupPin, setSetupPin] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupConfirm, setSetupConfirm] = useState("");

  // Login state
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [usingPassword, setUsingPassword] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/auth/status`)
      .then((res) => res.json())
      .then((data) => setMode(data.configured ? "login" : "setup"))
      .catch(() => setError("Can't reach the backend. Is uvicorn running?"));
  }, []);

  async function handleSetup(e) {
    e.preventDefault();
    setError("");
    if (setupPin.length !== 4) return setError("Pin must be 4 digits.");
    if (setupPassword !== setupConfirm) return setError("Passwords don't match.");
    if (setupPassword.length < 6) return setError("Password must be at least 6 characters.");

    const res = await fetch(`${API_BASE}/auth/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: setupPin, password: setupPassword }),
    });
    if (!res.ok) {
      const data = await res.json();
      return setError(data.detail || "Setup failed.");
    }

    // auto-login right after setup
    const loginRes = await fetch(`${API_BASE}/auth/login/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: setupPin }),
    });
    const loginData = await loginRes.json();
    localStorage.setItem("journal_token", loginData.token);
    onAuthenticated();
  }

  async function handlePinDigit(digit) {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      const res = await fetch(`${API_BASE}/auth/login/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: next }),
      });
      if (!res.ok) {
        setError("Incorrect pin.");
        setPin("");
        return;
      }
      const data = await res.json();
      localStorage.setItem("journal_token", data.token);
      onAuthenticated();
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setError("");
    const res = await fetch(`${API_BASE}/auth/login/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) return setError("Incorrect password.");
    const data = await res.json();
    localStorage.setItem("journal_token", data.token);
    onAuthenticated();
  }

  if (mode === "loading") {
    return <div className="login-screen"><p>Loading...</p></div>;
  }

  if (mode === "setup") {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1 className="login-title">Set up your journal</h1>
          <p className="login-subtitle">Choose a 4-digit pin for quick access, and a password as backup.</p>
          <form onSubmit={handleSetup} className="login-form">
            <input
              type="password" inputMode="numeric" maxLength={4}
              placeholder="4-digit pin" value={setupPin}
              onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, ""))}
            />
            <input
              type="password" placeholder="Password"
              value={setupPassword} onChange={(e) => setSetupPassword(e.target.value)}
            />
            <input
              type="password" placeholder="Confirm password"
              value={setupConfirm} onChange={(e) => setSetupConfirm(e.target.value)}
            />
            {error && <p className="login-error">{error}</p>}
            <button type="submit">Create journal</button>
          </form>
        </div>
      </div>
    );
  }

  // mode === "login"
  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="login-title">Welcome back</h1>
        <p className="login-subtitle">
          {usingPassword ? "Enter your password" : "Enter your pin to open your journal"}
        </p>

        {!usingPassword ? (
          <>
            <div className="pin-dots">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`dot ${i < pin.length ? "filled" : ""}`} />
              ))}
            </div>
            <div className="keypad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button key={n} onClick={() => handlePinDigit(String(n))}>{n}</button>
              ))}
              <span />
              <button onClick={() => handlePinDigit("0")}>0</button>
              <button onClick={() => setPin(pin.slice(0, -1))}>⌫</button>
            </div>
          </>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="login-form">
            <input
              type="password" placeholder="Password" value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit">Unlock journal</button>
          </form>
        )}

        {error && <p className="login-error">{error}</p>}

        <button className="login-toggle" onClick={() => { setUsingPassword(!usingPassword); setError(""); }}>
          {usingPassword ? "Use pin instead" : "Use password instead"}
        </button>
      </div>
    </div>
  );
}
