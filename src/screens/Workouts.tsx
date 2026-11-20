import { ChevronDown, ChevronUp } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { moveItem } from "../logic/editing";
import { splitWorkoutName } from "../logic/input";
import { useDb } from "../storage/DbContext";
import { createWorkout, loadWorkoutList, setRotation } from "../storage/repo";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Notice";
import { ScreenHeader } from "../ui/ScreenHeader";

type Props = { onEdit: (workoutId: string) => void };

/** The rotation, in order. Tap a workout to edit it; Move up / Move down to reorder. */
export function Workouts({ onEdit }: Props) {
  const db = useDb();
  const state = useLiveQuery(() => loadWorkoutList(db), [db]);
  const [creating, setCreating] = useState(false);

  if (!state) return <ScreenHeader title="Workouts" />;
  const { workouts, rotationIds } = state;

  const move = (from: number, to: number) => {
    setRotation(db, moveItem(rotationIds, from, to)).catch((err: unknown) => console.error("Couldn't save", err));
  };

  const create = async () => {
    setCreating(true);
    try {
      onEdit(await createWorkout(db, "New workout"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <ScreenHeader title="Workouts" subtitle="In rotation order" />

      {workouts.length === 0 && (
        <Notice>
          <p className="empty-text">No workouts yet. Add one with New workout and it joins the rotation.</p>
        </Notice>
      )}

      {workouts.map((w) => {
        const { title, subtitle } = splitWorkoutName(w.name);
        const position = rotationIds.indexOf(w.id);
        const count = `${w.exercises.length} ${w.exercises.length === 1 ? "exercise" : "exercises"}`;
        return (
          <Notice key={w.id} className="notice--tap workout-row">
            <button type="button" className="contract-tap workout-row__edit" aria-label={`Edit ${title}`} onClick={() => onEdit(w.id)}>
              <span className="contract-tap__title">{title}</span>
              {subtitle && <span className="contract__subtitle">{subtitle}</span>}
              <span className="contract__meta">
                {position >= 0 ? `${position + 1} of ${rotationIds.length}` : "Not in the rotation"} · {count}
              </span>
            </button>
            {position >= 0 && (
              <div className="workout-row__moves">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Move ${title} up`}
                  disabled={position === 0}
                  onClick={() => move(position, position - 1)}
                >
                  <ChevronUp size={24} strokeWidth={2} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Move ${title} down`}
                  disabled={position === rotationIds.length - 1}
                  onClick={() => move(position, position + 1)}
                >
                  <ChevronDown size={24} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            )}
          </Notice>
        );
      })}

      <div className="board-actions">
        <Button variant="board" onClick={create} loading={creating} loadingLabel="Adding…">
          New workout
        </Button>
      </div>
    </>
  );
}
