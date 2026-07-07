import { useState, useEffect } from "react";
import "./Profile.css";

const API_URL = "http://localhost:8000";

export default function Profile({
  variant = "panel",
  onComplete,
  onClose,
  onLogout,
  onAccountDeleted,
}) {
  const isSetup = variant === "setup";
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/profile`)
      .then((res) => res.json())
      .then((data) => setDisplayName(data.display_name || ""))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch(`${API_URL}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setDisplayName(data.display_name || "");
      setSaved(true);
    } catch {
      setError("Could not save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/account`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      localStorage.removeItem("journal_token");
      onAccountDeleted?.();
    } catch {
      setError("Could not delete account. Please try again.");
      setDeleting(false);
    }
  };

  const formBody = (
    <>
      {loading ? (
        <p className="profile-loading">Loading...</p>
      ) : (
        <div className="profile-form">
          <label>
            Display name
            <input
              type="text"
              value={displayName}
              onChange={(e) => {
                setSaved(false);
                setError("");
                setDisplayName(e.target.value);
              }}
              placeholder="How should we greet you?"
            />
          </label>

          {error && <p className="profile-error">{error}</p>}

          <div className="profile-actions">
            <button
              type="button"
              className="profile-save-btn"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>
            {saved && <span className="profile-saved-msg">Saved</span>}
          </div>

          {isSetup && (
            <button
              type="button"
              className="profile-continue-btn"
              onClick={() => onComplete?.()}
            >
              Continue to Journal
            </button>
          )}

          {!isSetup && onLogout && (
            <button type="button" className="profile-logout-btn" onClick={onLogout}>
              Log out
            </button>
          )}

          {!isSetup && (
          <div className="profile-danger-zone">
            {!confirmDelete ? (
              <button
                type="button"
                className="profile-delete-btn"
                onClick={() => setConfirmDelete(true)}
              >
                Delete Account
              </button>
            ) : (
              <div className="profile-delete-confirm">
                <p>This permanently deletes your account, all entries, and all data. This cannot be undone.</p>
                <div className="profile-delete-actions">
                  <button
                    type="button"
                    className="profile-delete-confirm-btn"
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting..." : "Yes, delete everything"}
                  </button>
                  <button
                    type="button"
                    className="profile-delete-cancel-btn"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      )}
    </>
  );

  if (isSetup) {
    return (
      <div className="profile-setup-screen">
        <div className="profile-setup-card profile-light-card">
          <div className="profile-header">
            <h2>Your profile</h2>
          </div>
          <p className="profile-setup-subtitle">
            Set a display name, then continue to your journal.
          </p>
          {formBody}
        </div>
      </div>
    );
  }

  return (
    <div className="profile-panel" onClick={(e) => e.stopPropagation()}>
      <div className="profile-panel-card profile-light-card">
        <div className="profile-header">
          <h2>Profile</h2>
          <button type="button" className="profile-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        {formBody}
      </div>
    </div>
  );
}
