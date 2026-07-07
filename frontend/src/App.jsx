import { useState, useEffect } from "react";
import Calendar from "./Calendar";
import Login from "./Login";
import Profile from "./Profile";
import VoiceInput from "./VoiceInput";
import "./Login.css";
import "./App.css";

const API_URL = "http://localhost:8000";

const ACTION_LABELS = {
  coach: "Coach me",
  summarize: "Summarize",
  followup: "Follow-up questions",
  suggest: "Suggest more",
};

function CalendarIcon() {
  return (
    <svg className="view-icon" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 9.5h18M8 2.5v3M16 2.5v3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg className="view-icon" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function App() {
  const [entries, setEntries] = useState([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("list");
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [coachResults, setCoachResults] = useState({});
  const [showProfile, setShowProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState([]);

  const handleLogout = () => {
    localStorage.removeItem("journal_token");
    setIsAuthenticated(false);
    setShowProfile(false);
    setProfileComplete(false);
  };

  const handleAccountDeleted = () => {
    setIsAuthenticated(false);
    setShowProfile(false);
    setProfileComplete(false);
  };

  useEffect(() => {
    const token = localStorage.getItem("journal_token");
    if (!token) {
      setAuthChecked(true);
      return;
    }
    fetch(`${API_URL}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setIsAuthenticated(data.valid);
        if (data.valid) setProfileComplete(true);
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!showProfile) return;
    const closeProfile = () => setShowProfile(false);
    document.addEventListener("click", closeProfile);
    return () => document.removeEventListener("click", closeProfile);
  }, [showProfile]);

  const fetchEntries = async () => {
    const res = await fetch(`${API_URL}/entries`);
    const data = await res.json();
    setEntries(data);
  };

  useEffect(() => {
    if (isAuthenticated && profileComplete) {
      fetchEntries();
    }
  }, [isAuthenticated, profileComplete]);

  useEffect(() => {
    if (showTemplates && templates.length === 0) {
      fetch(`${API_URL}/templates`)
        .then((res) => res.json())
        .then(setTemplates)
        .catch(console.error);
    }
  }, [showTemplates, templates.length]);

  const applyTemplate = (promptText) => {
    setContent(promptText);
    setShowTemplates(false);
  };

  const handleVoiceTranscript = (text) => {
    setContent((prev) => {
      const needsSpace = prev && !prev.endsWith(" ") && !prev.endsWith("\n");
      return prev + (needsSpace ? " " : "") + text;
    });
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setLoading(true);
    await fetch(`${API_URL}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setContent("");
    await fetchEntries();
    setLoading(false);
  };

  const handleDelete = async (id) => {
    await fetch(`${API_URL}/entries/${id}`, { method: "DELETE" });
    fetchEntries();
  };

  const handleToggleBookmark = async (id) => {
    const res = await fetch(`${API_URL}/entries/${id}/bookmark`, { method: "PATCH" });
    const updated = await res.json();
    setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
  };

  const filteredEntries = entries.filter((entry) => {
    if (bookmarkedOnly && !entry.bookmarked) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const inContent = entry.content?.toLowerCase().includes(q);
    const inTags = entry.tags?.toLowerCase().includes(q);
    return inContent || inTags;
  });

  const handleCoachAction = async (entryId, actionType) => {
    const key = `${entryId}-${actionType}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(
        `${API_URL}/entries/${entryId}/actions/${actionType}`,
        { method: "POST" }
      );
      const newResult = await res.json();
      setCoachResults((prev) => ({
        ...prev,
        [entryId]: newResult,
      }));
    } catch (err) {
      console.error("Coach action failed:", err);
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const moodClass = (mood) => {
    if (!mood) return "mood-badge";
    return `mood-badge mood-${mood.toLowerCase().trim()}`;
  };

  if (!authChecked) {
    return <div className="login-screen"><p>Loading...</p></div>;
  }

  if (!isAuthenticated) {
    return <Login onAuthenticated={() => {
      setIsAuthenticated(true);
      setProfileComplete(false);
    }} />;
  }

  if (!profileComplete) {
    return (
      <Profile
        variant="setup"
        onComplete={() => setProfileComplete(true)}
        onAccountDeleted={handleAccountDeleted}
      />
    );
  }

  return (
    <div className="app">
      <div className="container">
        <div className="app-header">
          <div className="header-menu" onClick={(e) => e.stopPropagation()}>
            <button
              className="kebab-btn"
              onClick={() => setShowProfile((o) => !o)}
            >
              &#8942;
            </button>
            {showProfile && (
              <Profile
                variant="panel"
                onClose={() => setShowProfile(false)}
                onLogout={handleLogout}
                onAccountDeleted={handleAccountDeleted}
              />
            )}
          </div>
          <h1>AI Journal</h1>
          <p>Write freely. Let the model reflect it back.</p>
        </div>

        <div className="view-toggle-row">
          <div className="view-toggle">
            <button
              type="button"
              className={`view-toggle-btn${view === "list" ? " active" : ""}`}
              onClick={() => setView("list")}
              title="List view"
            >
              <ListIcon />
              <span>List</span>
            </button>
            <button
              type="button"
              className={`view-toggle-btn icon-only${view === "calendar" ? " active" : ""}`}
              onClick={() => setView("calendar")}
              title="Calendar view"
              aria-label="Calendar view"
            >
              <CalendarIcon />
            </button>
          </div>
          <button
            type="button"
            className={`bookmark-filter-btn${bookmarkedOnly ? " active" : ""}`}
            onClick={() => setBookmarkedOnly((o) => !o)}
            title="Show bookmarks only"
          >
            Bookmarks
          </button>
        </div>

        <div className="entry-toolbar">
          <input
            type="text"
            className="entry-search-input"
            placeholder="Search entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="entry-card">
          <div className="entry-composer">
            <textarea
              placeholder="What's on your mind today?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <VoiceInput onTranscript={handleVoiceTranscript} />
          </div>
          <div className="entry-footer">
            <button
              type="button"
              className="templates-btn"
              onClick={() => setShowTemplates(true)}
            >
              Quick Templates
            </button>
            <button
              className="save-btn"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Analyzing..." : "Save Entry"}
            </button>
          </div>
        </div>

        {view === "list" ? (
          filteredEntries.length === 0 ? (
            <div className="empty-state">
              <p>
                {entries.length === 0
                  ? "No entries yet — write your first one above."
                  : "No entries match your search or filter."}
              </p>
            </div>
          ) : (
            <div className="entries-list">
              {filteredEntries.map((entry) => (
                <div key={entry.id} className="entry">
                  <div className="entry-top">
                    <span className="entry-date">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                    <div className="entry-top-actions">
                      <button
                        type="button"
                        className={`bookmark-btn${entry.bookmarked ? " bookmarked" : ""}`}
                        onClick={() => handleToggleBookmark(entry.id)}
                        title={entry.bookmarked ? "Remove bookmark" : "Bookmark"}
                        aria-label={entry.bookmarked ? "Remove bookmark" : "Bookmark"}
                      >
                        {entry.bookmarked ? "\u2605" : "\u2606"}
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => handleDelete(entry.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="entry-content">{entry.content}</p>
                  <div className="entry-meta">
                    {entry.mood && (
                      <span className={moodClass(entry.mood)}>{entry.mood}</span>
                    )}
                  </div>

                  <div className="coach-actions-bar">
                    {["coach", "summarize", "followup", "suggest"].map((action) => (
                      <button
                        key={action}
                        className={
                          "coach-action-btn" +
                          (coachResults[entry.id]?.action_type === action ? " active" : "")
                        }
                        disabled={actionLoading[`${entry.id}-${action}`]}
                        onClick={() => handleCoachAction(entry.id, action)}
                      >
                        {actionLoading[`${entry.id}-${action}`]
                          ? "..."
                          : ACTION_LABELS[action]}
                      </button>
                    ))}
                  </div>

                  {coachResults[entry.id] && (
                    <div className="coach-results">
                      <div className="coach-result-item">
                        <span className="coach-result-label">
                          {ACTION_LABELS[coachResults[entry.id].action_type]}
                        </span>
                        <p>{coachResults[entry.id].result}</p>
                        {coachResults[entry.id].action_type === "summarize" && entry.tags && (
                          <p className="tags-text">{entry.tags}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          <Calendar
            entries={filteredEntries}
            onSelectEntry={(entry) => setView("list")}
          />
        )}
      </div>
      {showTemplates && (
        <div className="modal-overlay" onClick={() => setShowTemplates(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Quick Templates</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowTemplates(false)}
              >
                &times;
              </button>
            </div>
            <ul className="template-list">
              {templates.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => applyTemplate(t.prompt_text)}>
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
