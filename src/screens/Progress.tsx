import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight } from "lucide-react";
import { shortDate } from "../logic/clock";
import { useDb } from "../storage/DbContext";
import { loadProgressList } from "../storage/repo";
import { Notice } from "../ui/Notice";
import { ScreenHeader } from "../ui/ScreenHeader";

type Props = { onOpen: (exerciseId: string) => void };

/** Every exercise you've logged, most recently done first. */
export function Progress({ onOpen }: Props) {
  const db = useDb();
  const list = useLiveQuery(() => loadProgressList(db), [db]);
  if (!list) return null;

  return (
    <>
      <ScreenHeader title="Progress" />
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
