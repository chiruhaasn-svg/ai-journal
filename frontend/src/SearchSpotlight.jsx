import { useState, useEffect, useRef, useCallback } from "react";
import "./SearchSpotlight.css";

const API_URL = "http://localhost:8000";

export default function SearchSpotlight({ onClose }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("home");
  const [quickResults, setQuickResults] = useState([]);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [tags, setTags] = useState([]);
  const [tagResults, setTagResults] = useState([]);
  const [activeTag, setActiveTag] = useState("");
  const [bookmarks, setBookmarks] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const runQuickSearch = useCallback((q) => {
    if (!q.trim()) {
      setQuickResults([]);
      setMode("home");
      return;
    }
    fetch(`${API_URL}/entries/quick-search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data) => {
        setQuickResults(data);
        setMode("quick");
      })
      .catch(console.error);
  }, []);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setAiResult(null);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runQuickSearch(val), 250);
  };

  const handleAskAI = async () => {
    if (!query.trim()) return;
    setAiLoading(true);
    setMode("ai");
    try {
      const res = await fetch(
        `${API_URL}/entries/search?query=${encodeURIComponent(query)}&limit=5`
      );
      const data = await res.json();
      setAiResult(data);
    } catch (err) {
      console.error("AI search failed:", err);
      setAiResult([]);
    } finally {
      setAiLoading(false);
    }
  };

  const openTags = () => {
    fetch(`${API_URL}/tags`)
      .then((r) => r.json())
      .then((data) => {
        setTags(data.tags || []);
        setMode("tags");
      })
      .catch(console.error);
  };

  const selectTag = (tag) => {
    setActiveTag(tag);
    fetch(`${API_URL}/entries/by-tag/${encodeURIComponent(tag)}`)
      .then((r) => r.json())
      .then((data) => {
        setTagResults(data);
        setMode("tag-results");
      })
      .catch(console.error);
  };

  const openBookmarks = () => {
    fetch(`${API_URL}/entries/bookmarked`)
      .then((r) => r.json())
      .then((data) => {
        setBookmarks(data);
        setMode("bookmarks");
      })
      .catch(console.error);
  };

  const openReviews = () => {
    fetch(`${API_URL}/reviews`)
      .then((r) => r.json())
      .then((data) => {
        setReviews(data);
        setMode("reviews");
      })
      .catch(console.error);
  };

  const generateReview = async (periodType) => {
    setReviewLoading(true);
    try {
      const res = await fetch(`${API_URL}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_type: periodType }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || "Could not generate review.");
        return;
      }
      const newReview = await res.json();
      setReviews((prev) => [newReview, ...prev]);
    } catch (err) {
      console.error("Review generation failed:", err);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleSubmit = () => {
    handleAskAI();
  };

  const renderEntryCard = (entry) => (
    <div key={entry.id} className="spotlight-entry-card">
      <div className="spotlight-entry-top">
        <span className="spotlight-entry-date">
          {new Date(entry.created_at).toLocaleDateString()}
        </span>
        {entry.mood && <span className="spotlight-entry-mood">{entry.mood}</span>}
      </div>
      <p className="spotlight-entry-content">{entry.content}</p>
      {entry.tags && <p className="spotlight-entry-tags">{entry.tags}</p>}
    </div>
  );

  return (
    <div className="spotlight-overlay" onClick={onClose}>
      <div className="spotlight-modal" onClick={(e) => e.stopPropagation()}>
        <div className="spotlight-header-row">
          {mode !== "home" ? (
            <button
              className="spotlight-back-btn"
              onClick={() => {
                setMode("home");
                setQuery("");
                setAiResult(null);
              }}
            >
              &larr; Back
            </button>
          ) : (
            <span className="spotlight-title">Search</span>
          )}
          <span className="spotlight-ai-badge">AI-Powered</span>
        </div>

        {mode === "home" && (
          <>
            <p className="spotlight-section-label">BROWSE ENTRIES</p>
            <div className="spotlight-shortcuts">
              <button className="spotlight-shortcut-btn" onClick={openTags}>
                Tag: By Tag
              </button>
              <button className="spotlight-shortcut-btn" onClick={openBookmarks}>
                Bookmarked
              </button>
              <button className="spotlight-shortcut-btn" onClick={openReviews}>
                Reviews
              </button>
            </div>
            <p className="spotlight-section-label">ASK A QUESTION</p>
            <button
              className="spotlight-suggestion-pill"
              onClick={() => {
                setQuery("How have I been feeling lately?");
                inputRef.current?.focus();
              }}
            >
              "How have I been feeling lately?"
            </button>
          </>
        )}

        {mode === "tags" && (
          <>
            <p className="spotlight-section-label">TAGS</p>
            <div className="spotlight-tag-list">
              {tags.length === 0 && <p className="spotlight-empty">No tags yet.</p>}
              {tags.map((tag) => (
                <button
                  key={tag}
                  className="spotlight-tag-chip"
                  onClick={() => selectTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </>
        )}

        {mode === "tag-results" && (
          <>
            <p className="spotlight-section-label">TAGGED "{activeTag.toUpperCase()}"</p>
            <div className="spotlight-results">
              {tagResults.length === 0 && <p className="spotlight-empty">No entries found.</p>}
              {tagResults.map(renderEntryCard)}
            </div>
          </>
        )}

        {mode === "bookmarks" && (
          <>
            <p className="spotlight-section-label">BOOKMARKED ENTRIES</p>
            <div className="spotlight-results">
              {bookmarks.length === 0 && (
                <p className="spotlight-empty">No bookmarked entries yet.</p>
              )}
              {bookmarks.map(renderEntryCard)}
            </div>
          </>
        )}

        {mode === "reviews" && (
          <>
            <p className="spotlight-section-label">REVIEWS</p>
            <div className="spotlight-review-actions">
              <button disabled={reviewLoading} onClick={() => generateReview("week")}>
                {reviewLoading ? "..." : "Weekly review"}
              </button>
              <button disabled={reviewLoading} onClick={() => generateReview("month")}>
                {reviewLoading ? "..." : "Monthly review"}
              </button>
              <button disabled={reviewLoading} onClick={() => generateReview("year")}>
                {reviewLoading ? "..." : "Year in review"}
              </button>
            </div>
            <div className="spotlight-results">
              {reviews.length === 0 && <p className="spotlight-empty">No reviews yet.</p>}
              {reviews.map((review) => (
                <div key={review.id} className="spotlight-review-card">
                  <span className="spotlight-review-label">
                    {review.period_type} - {review.period_label}
                  </span>
                  <p className="spotlight-review-content">{review.content}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {mode === "quick" && (
          <>
            <p className="spotlight-section-label">MATCHING ENTRIES</p>
            <div className="spotlight-results">
              {quickResults.length === 0 && (
                <p className="spotlight-empty">No matches — try Ask AI below.</p>
              )}
              {quickResults.map(renderEntryCard)}
            </div>
          </>
        )}

        {mode === "ai" && (
          <>
            <p className="spotlight-section-label">AI ANSWER</p>
            {aiLoading && <p className="spotlight-loading">Thinking...</p>}
            {!aiLoading && aiResult && aiResult.length === 0 && (
              <p className="spotlight-empty">No related entries found.</p>
            )}
            {!aiLoading && aiResult && (
              <div className="spotlight-results">{aiResult.map(renderEntryCard)}</div>
            )}
          </>
        )}

        <div className="spotlight-search-row">
          <span className="spotlight-sparkle">*</span>
          <input
            ref={inputRef}
            className="spotlight-input"
            type="text"
            placeholder="Search or Ask"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
          <button className="spotlight-send-btn" onClick={handleSubmit}>
            &uarr;
          </button>
        </div>
      </div>
    </div>
  );
}
