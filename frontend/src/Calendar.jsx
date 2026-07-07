import { useState } from "react";
import "./Calendar.css";

function Calendar({ entries, onSelectEntry }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const entriesByDay = entries.reduce((acc, entry) => {
    const d = new Date(entry.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  const firstDayOfMonth = new Date(year, month, 1);
  const startWeekday = firstDayOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  const monthLabel = currentDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const goPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  };
  const goNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  };

  const isToday = (day) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const selectedKey = selectedDay ? `${year}-${month}-${selectedDay}` : null;
  const selectedEntries = selectedKey ? entriesByDay[selectedKey] || [] : [];

  return (
    <div className="calendar-wrapper">
      <div className="calendar-nav">
        <button onClick={goPrevMonth}>&larr;</button>
        <h2>{monthLabel}</h2>
        <button onClick={goNextMonth}>&rarr;</button>
      </div>

      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="calendar-weekday">
            {d}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) return <div key={idx} className="calendar-cell empty" />;
          const key = `${year}-${month}-${day}`;
          const dayEntries = entriesByDay[key] || [];
          return (
            <div
              key={idx}
              className={`calendar-cell ${dayEntries.length ? "has-entries" : ""} ${
                isToday(day) ? "today" : ""
              } ${selectedDay === day ? "selected" : ""}`}
              onClick={() => setSelectedDay(day)}
            >
              <span className="cell-day">{day}</span>
              {dayEntries.length > 0 && (
                <span className="entry-dot">{dayEntries.length}</span>
              )}
            </div>
          );
        })}
      </div>

      {selectedDay && (
        <div className="calendar-day-detail">
          <h3>
            {monthLabel.split(" ")[0]} {selectedDay}, {year}
          </h3>
          {selectedEntries.length === 0 ? (
            <p className="no-entries">No entries this day.</p>
          ) : (
            selectedEntries.map((entry) => (
              <div
                key={entry.id}
                className="calendar-entry-preview"
                onClick={() => onSelectEntry(entry)}
              >
                <span className="entry-time">
                  {new Date(entry.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <p>{entry.content.slice(0, 80)}{entry.content.length > 80 ? "…" : ""}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default Calendar;
