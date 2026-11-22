import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { shortDate } from "../logic/clock";
import { shortSet } from "../logic/format";
import { useDb } from "../storage/DbContext";
import { deleteExercise, loadExerciseHistory } from "../storage/repo";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Notice";
import { ScreenHeader } from "../ui/ScreenHeader";
import { Sheet } from "../ui/Sheet";
import { CHART_TITLES, ProgressChart } from "./ProgressChart";

type Props = {
  exerciseId: string;
  onBack: () => void;
  onOpenSession: (sessionId: string, exerciseName: string) => void;
};

/** One exercise: its chart, then every past session with its sets and note. */
export function ExerciseHistory({ exerciseId, onBack, onOpenSession }: Props) {
  const db = useDb();
  const state = useLiveQuery(() => loadExerciseHistory(db, exerciseId), [db, exerciseId]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removing, setRemoving] = useState(false);

  // The exercise was deleted elsewhere: go back.
  useEffect(() => {
    if (state && !state.exercise) onBack();
  }, [state, onBack]);

  if (!state?.exercise) return null;
  const { exercise, metric, points, sessions } = state;

  return (
    <>
      <ScreenHeader back={{ label: "Progress", onClick: onBack }} title={exercise.name} />
      {sessions.length === 0 ? (
        <Notice>
          <p className="empty-text">No sessions yet. Finish a workout with {exercise.name} and it shows up here.</p>
        </Notice>
      ) : (
        <>
          <Notice aria-label="Chart">
            <h2 className="chart-title">{CHART_TITLES[metric]}</h2>
            <ProgressChart metric={metric} points={points} />
          </Notice>
          <Notice aria-label="Past sessions">
            <ul className="history-list">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button type="button" className="history-row" onClick={() => onOpenSession(s.id, exercise.name)}>
                    <span className="history-row__sets">
                      {shortDate(s.date)} · {s.sets.map((set) => shortSet(set, exercise.measure)).join(" ")}
                    </span>
                    {s.note && <span className="history-row__note">{s.note}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </Notice>
        </>
      )}

      <div className="board-actions">
        <Button variant="text-board" onClick={() => setConfirmDelete(true)}>
          Delete exercise
        </Button>
      </div>

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Delete ${exercise.name}?`}>
        <p className="sheet__body">
          It comes out of every workout and off this list. Past sessions keep their sets, and making an exercise with the same name
          brings its history back.
        </p>
        <div className="sheet__actions">
          <Button variant="outline" onClick={() => setConfirmDelete(false)}>
            Keep exercise
          </Button>
          <Button
            variant="plain"
            loading={removing}
            loadingLabel="Deleting…"
            onClick={async () => {
              setRemoving(true);
              try {
                await deleteExercise(db, exercise.id);
                setConfirmDelete(false);
                onBack();
              } catch (err) {
                console.error("Couldn't delete", err);
                setRemoving(false);
              }
            }}
          >
            Delete exercise
          </Button>
        </div>
      </Sheet>
    </>
  );
}
