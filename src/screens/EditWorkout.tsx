import { ChevronDown, ChevronUp } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { cleanName, moveItem, setPlannedNumber } from "../logic/editing";
import { formatTarget } from "../logic/format";
import { splitWorkoutName } from "../logic/input";
import type { Exercise, Measure, PlannedExercise, Workout } from "../logic/types";
import { useDb } from "../storage/DbContext";
import { deleteWorkout, loadEditWorkout, patchWorkout, renameExercise, setExerciseMeasure } from "../storage/repo";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Notice";
import { ScreenHeader } from "../ui/ScreenHeader";
import { Sheet } from "../ui/Sheet";
import { TextField } from "../ui/TextField";

type Props = { workoutId: string; onClose: () => void };

function log(write: Promise<unknown>) {
  write.catch((err: unknown) => console.error("Couldn't save", err));
}

/** One notice per planned exercise, like Log Workout, showing targets instead of sets. Every field saves as you type. */
export function EditWorkout({ workoutId, onClose }: Props) {
  const db = useDb();
  const state = useLiveQuery(() => loadEditWorkout(db, workoutId), [db, workoutId]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleting = useRef(false);

  // The workout was deleted: go back.
  useEffect(() => {
    if (state && !state.workout && !deleting.current) onClose();
  }, [state, onClose]);

  if (!state?.workout) return null;
  const { workout, exercises } = state;
  const { title, subtitle } = splitWorkoutName(workout.name);

  const patch = (change: (w: Workout) => void) => patchWorkout(db, workoutId, change);

  return (
    <div className="edit">
      <ScreenHeader back={{ label: "Workouts", onClick: onClose }} title={title || "Workout"} subtitle={subtitle} />

      <Notice aria-label="Workout">
        <TextField
          label="Workout name"
          value={workout.name}
          placeholder="Upper A: Horizontal Push & Pull"
          onCommit={async (text) => {
            const name = cleanName(text);
            if (!name) throw new Error("Give the workout a name");
            await patch((w) => {
              w.name = name;
            });
          }}
        />
        <p className="form-hint">Anything after a colon shows as the subtitle.</p>
      </Notice>

      {workout.exercises.length === 0 && (
        <Notice>
          <p className="empty-text">No exercises yet. Add the first one below.</p>
        </Notice>
      )}

      {workout.exercises.map((planned, i) => (
        <PlanNotice
          key={`${planned.exerciseId}-${i}`}
          planned={planned}
          exercise={exercises[planned.exerciseId]}
          first={i === 0}
          last={i === workout.exercises.length - 1}
          onNumber={(field, text) =>
            patch((w) => {
              const result = setPlannedNumber(w.exercises[i], field, text);
              if (typeof result === "string") throw new Error(result);
              w.exercises[i] = result;
            })
          }
          onLabel={(text) =>
            patch((w) => {
              const label = cleanName(text);
              if (label) w.exercises[i].label = label;
              else delete w.exercises[i].label;
            })
          }
          onRename={(text) => renameExercise(db, planned.exerciseId, text)}
          onMeasure={(measure) => log(setExerciseMeasure(db, planned.exerciseId, measure))}
          onMove={(to) => log(patch((w) => void (w.exercises = moveItem(w.exercises, i, to === "up" ? i - 1 : i + 1))))}
          onRemove={() => log(patch((w) => void w.exercises.splice(i, 1)))}
        />
      ))}

      <div className="board-actions">
        <Button variant="text-board" onClick={() => setConfirmDelete(true)}>
          Delete workout
        </Button>
      </div>
      <div className="tabbar-spacer" />

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this workout?">
        <p className="sheet__body">{title || "It"} comes out of the rotation. Past sessions keep their sets.</p>
        <div className="sheet__actions">
          <Button variant="outline" onClick={() => setConfirmDelete(false)}>
            Keep workout
          </Button>
          <Button
            variant="plain"
            onClick={async () => {
              deleting.current = true;
              await deleteWorkout(db, workoutId);
              setConfirmDelete(false);
              onClose();
            }}
          >
            Delete workout
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

type PlanProps = {
  planned: PlannedExercise;
  exercise?: Exercise;
  first: boolean;
  last: boolean;
  onNumber: (field: "sets" | "targetMin" | "targetMax", text: string) => Promise<void>;
  onLabel: (text: string) => Promise<void>;
  onRename: (text: string) => Promise<void>;
  onMeasure: (measure: Measure) => void;
  onMove: (to: "up" | "down") => void;
  onRemove: () => void;
};

function PlanNotice({ planned, exercise, first, last, onNumber, onLabel, onRename, onMeasure, onMove, onRemove }: PlanProps) {
  const [open, setOpen] = useState(false);
  const name = exercise?.name ?? "Exercise";
  const measure = exercise?.measure ?? "reps";
  const unit = measure === "seconds" ? "sec" : "reps";
  const fieldsId = `plan-${planned.exerciseId}`;

  return (
    <Notice aria-label={name} className="exercise">
      <div className="exercise__head">
        <h2 className="exercise__name">{name}</h2>
        <span className="exercise__target">{formatTarget(planned, measure)}</span>
      </div>

      {open && (
        <div className="plan" id={fieldsId}>
          <TextField label="Exercise name" value={name} onCommit={onRename} />
          <div className="plan__numbers">
            <TextField label="Sets" inputMode="numeric" value={String(planned.sets)} onCommit={(t) => onNumber("sets", t)} />
            <TextField label={`Min ${unit}`} inputMode="numeric" value={String(planned.targetMin)} onCommit={(t) => onNumber("targetMin", t)} />
            <TextField
              label={`Max ${unit}`}
              inputMode="numeric"
              value={planned.targetMax === undefined ? "" : String(planned.targetMax)}
              placeholder="None"
              onCommit={(t) => onNumber("targetMax", t)}
            />
          </div>
          <TextField label="Label" value={planned.label ?? ""} placeholder="Optional" onCommit={onLabel} />

          <div className="form-field">
            <span className="form-field__label" id={`measure-${planned.exerciseId}`}>
              Measured in
            </span>
            <div className="segmented" role="group" aria-labelledby={`measure-${planned.exerciseId}`}>
              {(["reps", "seconds"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className="segmented__option"
                  aria-pressed={measure === m}
                  onClick={() => measure !== m && onMeasure(m)}
                >
                  {m === "reps" ? "Reps" : "Seconds"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="plan__actions">
        <button type="button" className="btn btn--plain" aria-label={`Move ${name} up`} disabled={first} onClick={() => onMove("up")}>
          <ChevronUp size={20} strokeWidth={2} aria-hidden="true" />
          Up
        </button>
        <button type="button" className="btn btn--plain" aria-label={`Move ${name} down`} disabled={last} onClick={() => onMove("down")}>
          <ChevronDown size={20} strokeWidth={2} aria-hidden="true" />
          Down
        </button>
        <span className="plan__spacer" />
        {open && (
          <button type="button" className="btn btn--plain" aria-label={`Remove ${name}`} onClick={onRemove}>
            Remove
          </button>
        )}
        <button
          type="button"
          className="btn btn--text"
          aria-label={`Edit ${name}`}
          aria-expanded={open}
          aria-controls={open ? fieldsId : undefined}
          onClick={() => setOpen(!open)}
        >
          {open ? "Done" : "Edit"}
        </button>
      </div>
    </Notice>
  );
}
