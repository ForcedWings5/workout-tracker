import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthGrid, WEEKDAYS, weekdayOf } from "../logic/schedule";
import type { DaySession } from "../storage/repo";
import { Notice } from "../ui/Notice";

export type CalendarState = { year: number; month: number; day?: string };

type Props = {
  state: CalendarState;
  today: string;
  sessions: Record<string, DaySession[]>;
  onChange: (state: CalendarState) => void;
  onOpen: (sessionId: string) => void;
};

const monthName = (year: number, month: number) => new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long" });
const shortMonth = (year: number, month: number) => new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short" });
const dayNumber = (date: string) => Number(date.slice(8));

/** A month of past workouts, Monday first. A red mark means a workout was done that day. */
export function HistoryCalendar({ state, today, sessions, onChange, onOpen }: Props) {
  const { year, month, day } = state;
  const title = `${monthName(year, month)} ${year}`;
  const [thisYear, thisMonth] = today.split("-").map(Number);
  const atCurrent = year > thisYear || (year === thisYear && month >= thisMonth);
  const shift = (by: number) => {
    const m = month + by;
    onChange({ year: year + Math.floor((m - 1) / 12), month: ((m - 1 + 12) % 12) + 1 });
  };
  const selected = day ? (sessions[day] ?? []) : [];

  return (
    <Notice aria-label={title} className="calendar">
      <div className="calendar__head">
        <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => shift(-1)}>
          <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
        </button>
        <h2 className="calendar__title">{title}</h2>
        <button type="button" className="icon-btn" aria-label="Next month" disabled={atCurrent} onClick={() => shift(1)}>
          <ChevronRight size={22} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className="calendar__grid" role="presentation">
        {WEEKDAYS.map((d) => (
          <span key={d} className="calendar__weekday" aria-hidden="true">
            {d[0]}
          </span>
        ))}
        {monthGrid(year, month)
          .flat()
          .map((date, i) => {
            if (!date) return <span key={`blank-${i}`} />;
            const done = sessions[date] ?? [];
            const name = `${WEEKDAYS[weekdayOf(date)]}, ${monthName(year, month)} ${dayNumber(date)}, ${done.length ? done.map((s) => s.title).join(", ") : "no workout"}`;
            const classes = ["calendar__day", date === today && "calendar__day--today", date === day && "calendar__day--selected"].filter(Boolean).join(" ");
            return (
              <button key={date} type="button" className={classes} aria-label={name} aria-pressed={date === day} onClick={() => onChange({ ...state, day: date })}>
                <span aria-hidden="true">{dayNumber(date)}</span>
                {done.length > 0 && <span className="calendar__mark" aria-hidden="true" />}
              </button>
            );
          })}
      </div>

      {day && (
        <div className="calendar__list">
          {selected.length === 0 ? (
            <p className="empty-text">
              No workout on {WEEKDAYS[weekdayOf(day)]}, {shortMonth(year, month)} {dayNumber(day)}.
            </p>
          ) : (
            selected.map((s) => (
              <button key={s.id} type="button" className="calendar__session" onClick={() => onOpen(s.id)}>
                {s.title} · {s.doneSets} {s.doneSets === 1 ? "set" : "sets"}
              </button>
            ))
          )}
        </div>
      )}
    </Notice>
  );
}
