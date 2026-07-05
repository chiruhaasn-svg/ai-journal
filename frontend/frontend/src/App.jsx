import { useState, useEffect } from "react";
import "./App.css";

const API_URL = "http://localhost:8000";

function App() {
  const [entries, setEntries] = useState([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchEntries = async () => {
    const res = await fetch(`${API_URL}/entries`);
    const data = await res.json();
    setEntries(data);
  };

  useEffect(() => {
    fetchEntries();
  }, []);

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

  const moodClass = (mood) => {
    if (!mood) return "mood-badge";
    return `mood-badge mood-${mood.toLowerCase().trim()}`;
  };

  return (
    <div className="app">
      <div className="container">
        <div className="app-header">
          <h1>AI Journal</h1>
          <p>Write freely. Let the model reflect it back.</p>
        </div>

        <div className="entry-card">
          <textarea
            placeholder="What's on your mind today?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="entry-footer">
            <button
              className="save-btn"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Analyzing..." : "Save Entry"}
            </button>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="empty-state">
            <p>No entries yet — write your first one above.</p>
          </div>
        ) : (
          <div className="entries-list">
            {entries.map((entry) => (
              <div key={entry.id} className="entry">
                <div className="entry-top">
                  <span className="entry-date">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(entry.id)}
                  >
                    Delete
                  </button>
                </div>
                <p className="entry-content">{entry.content}</p>
                <div className="entry-meta">
                  {entry.mood && (
                    <span className={moodClass(entry.mood)}>{entry.mood}</span>
                  )}
                  {entry.tags && (
                    <span className="tags-text">{entry.tags}</span>
                  )}
                </div>
                {entry.summary && (
                  <p className="entry-summary">{entry.summary}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;