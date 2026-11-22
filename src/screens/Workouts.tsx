import { Check, ChevronRight } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { splitWorkoutName } from "../logic/input";
import { WEEKDAYS } from "../logic/schedule";
import type { Workout } from "../logic/types";
import { useDb } from "../storage/DbContext";
import { createWorkout, loadWorkoutList, setScheduleDay } from "../storage/repo";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Notice";
import { ScreenHeader } from "../ui/ScreenHeader";
import { Sheet } from "../ui/Sheet";

type Props = { onEdit: (workoutId: string) => void };

const titleOf = (w?: Workout) => (w ? splitWorkoutName(w.name).title : "Rest");

/** The week, Monday first, then every workout. Tap a day to change it; tap a workout to edit it. */
export function Workouts({ onEdit }: Props) {
  const db = useDb();
  const state = useLiveQuery(() => loadWorkoutList(db), [db]);
  const [creating, setCreating] = useState(false);
  /** The weekday whose picker sheet is open. */
  const [picking, setPicking] = useState<number>();

  if (!state) return <ScreenHeader title="Workouts" />;
  const { workouts, days } = state;
  const byId = new Map(workouts.map((w) => [w.id, w]));
  const dayOf = (i: number) => byId.get(days[i] ?? "");

  const create = async () => {
    setCreating(true);
    try {
      onEdit(await createWorkout(db, "New workout"));
    } finally {
      setCreating(false);
    }
  };

  const pick = (workoutId: string | null) => {
    if (picking === undefined) return;
    setScheduleDay(db, picking, workoutId).catch((err: unknown) => console.error("Couldn't save", err));
    setPicking(undefined);
  };

  return (
    <>
      <ScreenHeader title="Workouts" />

      <Notice aria-labelledby="week-title">
        <h2 className="settings__title" id="week-title">
          This week
        </h2>
        <ul className="week">
          {WEEKDAYS.map((day, i) => {
            const workout = dayOf(i);
            return (
              <li key={day}>
                <button type="button" className="week__day" aria-label={`${day}: ${titleOf(workout)}`} onClick={() => setPicking(i)}>
                  <span className="week__name">{day}</span>
                  <span className={workout ? "week__workout" : "week__workout week__workout--rest"}>{titleOf(workout)}</span>
                  <ChevronRight className="week__chevron" size={20} strokeWidth={2} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </Notice>

      {workouts.length === 0 && (
        <Notice>
          <p className="empty-text">No workouts yet. Add one with New workout, then set it on a day of the week.</p>
        </Notice>
      )}

      {workouts.map((w) => {
        const { title, subtitle } = splitWorkoutName(w.name);
        const on = WEEKDAYS.filter((_, i) => days[i] === w.id);
        const count = `${w.exercises.length} ${w.exercises.length === 1 ? "exercise" : "exercises"}`;
        return (
          <Notice key={w.id} className="notice--tap">
            <button type="button" className="contract-tap" aria-label={`Edit ${title}`} onClick={() => onEdit(w.id)}>
              <span className="contract-tap__title">{title}</span>
              {subtitle && <span className="contract__subtitle">{subtitle}</span>}
              <span className="contract__meta">
                {on.length > 0 ? on.join(", ") : "Not scheduled"} · {count}
              </span>
            </button>
          </Notice>
        );
      })}

      <div className="board-actions">
        <Button variant="board" onClick={create} loading={creating} loadingLabel="Adding…">
          New workout
        </Button>
      </div>

      <Sheet open={picking !== undefined} onClose={() => setPicking(undefined)} title={picking !== undefined ? WEEKDAYS[picking] : ""}>
        <ul className="picker__list week__picker">
          {workouts.map((w) => (
            <li key={w.id}>
              <button type="button" className="picker__option" aria-pressed={picking !== undefined && days[picking] === w.id} onClick={() => pick(w.id)}>
                <span className="picker__name">{titleOf(w)}</span>
                {picking !== undefined && days[picking] === w.id && <Check className="week__check" size={20} strokeWidth={2.5} aria-hidden="true" />}
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="picker__option" aria-pressed={picking !== undefined && !dayOf(picking)} onClick={() => pick(null)}>
              <span className="picker__name">Rest</span>
              {picking !== undefined && !dayOf(picking) && <Check className="week__check" size={20} strokeWidth={2.5} aria-hidden="true" />}
            </button>
          </li>
        </ul>
      </Sheet>
    </>
  );
}
