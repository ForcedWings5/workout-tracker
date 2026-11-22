import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight } from "lucide-react";
import { shortDate, todayLocal } from "../logic/clock";
import { useDb } from "../storage/DbContext";
import { loadMonthSessions, loadProgressList } from "../storage/repo";
import { Notice } from "../ui/Notice";
import { ScreenHeader } from "../ui/ScreenHeader";
import { HistoryCalendar, type CalendarState } from "./HistoryCalendar";

type Props = {
  onOpen: (exerciseId: string) => void;
  /** The calendar's month and selected day; kept by the app so it's still there after opening a session. */
  calendar?: CalendarState;
  onCalendar: (state: CalendarState) => void;
  onOpenSession: (sessionId: string) => void;
};

/** The history calendar, then every exercise you've logged, most recently done first. */
export function Progress({ onOpen, calendar, onCalendar, onOpenSession }: Props) {
  const db = useDb();
  const today = todayLocal();
  const [y, m] = today.split("-").map(Number);
  const month = calendar ?? { year: y, month: m };
  const list = useLiveQuery(() => loadProgressList(db), [db]);
  const sessions = useLiveQuery(() => loadMonthSessions(db, month.year, month.month), [db, month.year, month.month]);
  if (!list || !sessions) return null;

  return (
    <>
      <ScreenHeader title="Progress" />
      <HistoryCalendar state={month} today={today} sessions={sessions} onChange={onCalendar} onOpen={onOpenSession} />
      {list.length === 0 ? (
        <Notice>
          <p className="empty-text">No sessions yet. Finish a workout and every exercise you logged shows up here.</p>
        </Notice>
      ) : (
        <Notice aria-label="Exercises">
          <ul className="progress-list">
            {list.map(({ exercise, lastDate }) => (
              <li key={exercise.id}>
                <button type="button" className="progress-row" onClick={() => onOpen(exercise.id)}>
                  <span className="progress-row__name">{exercise.name}</span>
                  <span className="visually-hidden">, </span>
                  <span className="progress-row__last">last {shortDate(lastDate)}</span>
                  <ChevronRight className="progress-row__chevron" size={20} strokeWidth={2} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </Notice>
      )}
    </>
  );
}
