import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { shortDate } from "../logic/clock";
import { splitWorkoutName } from "../logic/input";
import { sessionProgress } from "../logic/session";
import type { Session, Workout } from "../logic/types";
import { useDb } from "../storage/DbContext";
import { discardWorkout, loadTodayState, startWorkout } from "../storage/repo";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Notice";
import { ScreenHeader } from "../ui/ScreenHeader";
import { Sheet } from "../ui/Sheet";

type Props = { onOpenLog: (sessionId: string) => void };

function exerciseCount(w: Workout): string {
  return `${w.exercises.length} ${w.exercises.length === 1 ? "exercise" : "exercises"}`;
}

export function Today({ onOpenLog }: Props) {
  const db = useDb();
  const state = useLiveQuery(() => loadTodayState(db), [db]);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [starting, setStarting] = useState(false);

  const start = async (workoutId: string) => {
    if (starting) return;
    setStarting(true);
    try {
      onOpenLog(await startWorkout(db, workoutId));
    } finally {
      setStarting(false);
    }
  };

  if (!state) return <ScreenHeader title="Today" />;

  const { inProgress, workouts, nextUpId, lastDateByWorkout } = state;
  const nextUp = workouts.find((w) => w.id === nextUpId);
  const others = workouts.filter((w) => w.id !== nextUp?.id);

  return (
    <>
      <ScreenHeader title="Today" />

      {inProgress ? (
        <InProgress session={inProgress} onResume={() => onOpenLog(inProgress.id)} onDiscard={() => setConfirmDiscard(true)} />
      ) : nextUp ? (
        <NextUp workout={nextUp} lastDate={lastDateByWorkout[nextUp.id]} starting={starting} onStart={() => start(nextUp.id)} />
      ) : (
        <Notice>
          <p className="empty-text">No workouts yet. Add one under Workouts and it shows up here.</p>
        </Notice>
      )}

      {!inProgress && others.length > 0 && (
        <>
          <h2 className="board-heading">Other workouts</h2>
          {others.map((w) => {
            const { title, subtitle } = splitWorkoutName(w.name);
            const last = lastDateByWorkout[w.id];
            return (
              <Notice key={w.id} className="notice--tap">
                <button type="button" className="contract-tap" onClick={() => start(w.id)} disabled={starting}>
                  <span className="contract-tap__title">{title}</span>
                  {subtitle && <span className="contract__subtitle">{subtitle}</span>}
                  <span className="contract__meta">
                    {exerciseCount(w)}
                    {last && ` · last ${shortDate(last)}`}
                  </span>
                </button>
              </Notice>
            );
          })}
        </>
      )}

      <Sheet open={confirmDiscard} onClose={() => setConfirmDiscard(false)} title="Discard this workout?">
        <p className="sheet__body">The sets you've logged in {inProgress ? splitWorkoutName(inProgress.workoutName).title : "it"} will be deleted.</p>
        <div className="sheet__actions">
          <Button variant="outline" onClick={() => setConfirmDiscard(false)}>
            Keep workout
          </Button>
          <Button
            variant="plain"
            onClick={async () => {
              if (inProgress) await discardWorkout(db, inProgress.id);
              setConfirmDiscard(false);
            }}
          >
            Discard workout
          </Button>
        </div>
      </Sheet>
    </>
  );
}

function NextUp({ workout, lastDate, starting, onStart }: { workout: Workout; lastDate?: string; starting: boolean; onStart: () => void }) {
  const { title, subtitle } = splitWorkoutName(workout.name);
  return (
    <Notice aria-label={`Next up: ${title}`}>
      <p className="contract__meta">
        <span>Next up</span>
        {" · "}
        <span>{exerciseCount(workout)}</span>
        {lastDate && (
          <>
            {" · "}
            <span>last {shortDate(lastDate)}</span>
          </>
        )}
      </p>
      <h2 className="contract__title">{title}</h2>
      {subtitle && <p className="contract__subtitle">{subtitle}</p>}
      <div className="contract__action">
        <Button variant="primary" onClick={onStart} loading={starting} loadingLabel="Starting…">
          Start workout
        </Button>
      </div>
    </Notice>
  );
}

function InProgress({ session, onResume, onDiscard }: { session: Session; onResume: () => void; onDiscard: () => void }) {
  const { title, subtitle } = splitWorkoutName(session.workoutName);
  const { done, total } = sessionProgress(session);
  return (
    <>
      <Notice aria-label={`In progress: ${title}`}>
        <p className="contract__meta">
          <span>In progress since {shortDate(session.date)}</span>
          {" · "}
          <span>
            {done} of {total} sets
          </span>
        </p>
        <h2 className="contract__title">{title}</h2>
        {subtitle && <p className="contract__subtitle">{subtitle}</p>}
      </Notice>
      <div className="board-actions">
        <Button variant="board" onClick={onResume}>
          Resume
        </Button>
        <Button variant="text-board" onClick={onDiscard}>
          Discard
        </Button>
      </div>
    </>
  );
}
