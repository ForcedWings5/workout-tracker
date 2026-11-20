import { Trash2 } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { shortDate } from "../logic/clock";
import { describeSet, formatElapsed } from "../logic/format";
import { splitWorkoutName } from "../logic/input";
import { sessionProgress } from "../logic/session";
import type { Measure, Session } from "../logic/types";
import { useDb } from "../storage/DbContext";
import {
  addExerciseToSession,
  addSet,
  deleteSessionSet,
  discardWorkout,
  finishWorkout,
  loadLogState,
  removeSessionEntry,
  renameSession,
  setNote,
  skipOrRemoveSet,
  toggleSetDone,
  updateSet,
} from "../storage/repo";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Notice";
import { ScreenHeader } from "../ui/ScreenHeader";
import { Sheet } from "../ui/Sheet";
import { TextField } from "../ui/TextField";
import { ExerciseNotice } from "./ExerciseNotice";
import { ExercisePicker } from "./ExercisePicker";

type Props = { sessionId: string; onClose: () => void };

/** What a delete confirmation is asking about. The exerciseId guards against the list shifting underneath. */
type PendingDelete = { kind: "set"; entry: number; set: number; exerciseId: string } | { kind: "entry"; entry: number; exerciseId: string };

/** The first set, in session order, that is neither done nor skipped. */
function currentSetOf(session: Session): { entry: number; set: number } | undefined {
  for (let e = 0; e < session.entries.length; e++) {
    const set = session.entries[e].sets.findIndex((s) => !s.done && !s.skipped);
    if (set !== -1) return { entry: e, set };
  }
  return undefined;
}

const reducedMotion = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Seconds since this session was first opened on this phone. Survives reloads. */
function useElapsed(sessionId: string, running: boolean): number {
  const key = `workout-timer:${sessionId}`;
  const [startedAt] = useState(() => {
    let stored: number | undefined;
    try {
      stored = Number(localStorage.getItem(key)) || undefined;
      if (!stored) localStorage.setItem(key, String(Date.now()));
    } catch {
      // Storage unavailable: the timer starts from this screen.
    }
    return stored ?? Date.now();
  });
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  return Math.max(0, (now - startedAt) / 1000);
}

/** Fires a write without awaiting it. A refused or failed write is logged, never left unhandled. */
function run(write: Promise<unknown>) {
  write.catch((err: unknown) => console.error("Couldn't save", err));
}

function forgetTimer(sessionId: string) {
  try {
    localStorage.removeItem(`workout-timer:${sessionId}`);
  } catch {
    // Nothing to clean up.
  }
}

export function LogWorkout({ sessionId, onClose }: Props) {
  const db = useDb();
  const state = useLiveQuery(() => loadLogState(db, sessionId), [db, sessionId]);
  const [fulfilled, setFulfilled] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState<PendingDelete>();
  const scrollNext = useRef(false);
  const session = state?.session;
  const elapsed = useElapsed(sessionId, !fulfilled);

  // The session was discarded elsewhere: go back.
  useEffect(() => {
    if (state && !state.session && !fulfilled) onClose();
  }, [state, fulfilled, onClose]);

  // After a set is confirmed, bring the next set to the middle of the screen.
  useEffect(() => {
    if (!scrollNext.current) return;
    scrollNext.current = false;
    const next = document.querySelector<HTMLElement>('[data-current="true"]');
    next?.scrollIntoView?.({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
  }, [session]);

  if (!session || !state) return null;

  const { title, subtitle } = splitWorkoutName(session.workoutName);
  const current = currentSetOf(session);
  const progress = sessionProgress(session);

  if (fulfilled) return <Fulfilled session={session} names={state.exercises} onDone={onClose} />;

  // The toggle is computed from the stored set inside the write, so two quick taps cancel out.
  const toggle = (entryIndex: number, setIndex: number) =>
    run(
      toggleSetDone(db, sessionId, entryIndex, setIndex).then((done) => {
        if (done) scrollNext.current = true;
      }),
    );

  const fulfill = async () => {
    setFinishing(true);
    try {
      const result = await finishWorkout(db, sessionId);
      if (result === "empty") setConfirmEmpty(true);
      else {
        forgetTimer(sessionId);
        setFulfilled(true);
      }
    } finally {
      setFinishing(false);
    }
  };

  const headerSubtitle = [subtitle, progress.total > 0 && `${progress.done} of ${progress.total} ${progress.total === 1 ? "set" : "sets"}`].filter(Boolean).join(" · ");

  return (
    <div className="log">
      <ScreenHeader
        back={{ label: "Today", onClick: onClose }}
        right={
          <div className="log__corner">
            <span className="log__timer" aria-label={`Elapsed ${formatElapsed(elapsed)}`}>
              {formatElapsed(elapsed)}
            </span>
            {deleting ? (
              <button type="button" className="btn btn--text-board" onClick={() => setDeleting(false)}>
                Done
              </button>
            ) : (
              <button type="button" className="btn btn--text-board log__trash" aria-label="Delete sets or exercises" onClick={() => setDeleting(true)}>
                <Trash2 size={22} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </div>
        }
        title={title}
        subtitle={headerSubtitle}
      />

      {deleting && (
        <Notice>
          <p className="empty-text" role="status">
            Tap a set or exercise to delete it.
          </p>
        </Notice>
      )}

      {!session.workoutId && (
        <Notice aria-label="Workout">
          <TextField label="Workout name" value={session.workoutName} onCommit={(text) => renameSession(db, sessionId, text)} />
        </Notice>
      )}

      {session.entries.length === 0 && (
        <Notice>
          <p className="empty-text">No exercises yet. Add one below and its sets start from last time.</p>
        </Notice>
      )}

      {session.entries.map((entry, i) => {
        const exercise = state.exercises[entry.exerciseId];
        return (
          <ExerciseNotice
            key={`${entry.exerciseId}-${i}`}
            name={exercise?.name ?? "Exercise"}
            measure={exercise?.measure ?? "reps"}
            entry={entry}
            lastNote={state.lastNotes[entry.exerciseId]}
            currentSet={current?.entry === i ? current.set : undefined}
            onPatchSet={(s, patch) => run(updateSet(db, sessionId, i, s, patch))}
            onToggleSet={(s) => toggle(i, s)}
            onSkipSet={(s) => run(skipOrRemoveSet(db, sessionId, i, s))}
            onAddSet={() => run(addSet(db, sessionId, i))}
            onNote={(note) => run(setNote(db, sessionId, i, note))}
            deleting={deleting}
            onDeleteSet={(s) => setPending({ kind: "set", entry: i, set: s, exerciseId: entry.exerciseId })}
            onRemove={() => setPending({ kind: "entry", entry: i, exerciseId: entry.exerciseId })}
          />
        );
      })}

      <div className="board-actions">
        <Button variant="board" disabled={deleting} onClick={() => setPicking(true)}>
          Add exercise
        </Button>
      </div>

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(exercise) => {
          setPicking(false);
          run(addExerciseToSession(db, sessionId, exercise.id));
        }}
      />

      <div className="fulfill-spacer" />
      <div className="fulfill-bar">
        <Button variant="primary" disabled={deleting} onClick={fulfill} loading={finishing}>
          Fulfill contract
        </Button>
      </div>

      <DeleteSheet
        pending={pending}
        session={session}
        names={state.exercises}
        onKeep={() => setPending(undefined)}
        onConfirm={(p) => {
          setPending(undefined);
          run(p.kind === "set" ? deleteSessionSet(db, sessionId, p.entry, p.set, p.exerciseId) : removeSessionEntry(db, sessionId, p.entry, p.exerciseId));
        }}
      />

      <Sheet open={confirmEmpty} onClose={() => setConfirmEmpty(false)} title="Nothing logged yet">
        <p className="sheet__body">Discard this workout?</p>
        <div className="sheet__actions">
          <Button variant="outline" onClick={() => setConfirmEmpty(false)}>
            Keep logging
          </Button>
          <Button
            variant="plain"
            onClick={async () => {
              await discardWorkout(db, sessionId);
              forgetTimer(sessionId);
              setConfirmEmpty(false);
              onClose();
            }}
          >
            Discard workout
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

/** Confirms one delete in delete mode. Only today's session changes. */
function DeleteSheet({
  pending,
  session,
  names,
  onKeep,
  onConfirm,
}: {
  pending?: PendingDelete;
  session: Session;
  names: Record<string, { name: string; measure: Measure }>;
  onKeep: () => void;
  onConfirm: (p: PendingDelete) => void;
}) {
  const entry = pending ? session.entries[pending.entry] : undefined;
  const exercise = pending ? names[pending.exerciseId] : undefined;
  const name = exercise?.name ?? "Exercise";

  if (pending?.kind === "set") {
    const set = entry?.sets[pending.set];
    return (
      <Sheet open onClose={onKeep} title={`Delete set ${pending.set + 1}?`}>
        <p className="sheet__body">
          {name}
          {set ? ` · ${describeSet(set, exercise?.measure ?? "reps")}` : ""}.
        </p>
        <div className="sheet__actions">
          <Button variant="outline" onClick={onKeep}>
            Keep set
          </Button>
          <Button variant="plain" onClick={() => onConfirm(pending)}>
            Delete set
          </Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open={pending?.kind === "entry"} onClose={onKeep} title={`Remove ${name} from today?`}>
      <p className="sheet__body">Its sets from today go too.</p>
      <div className="sheet__actions">
        <Button variant="outline" onClick={onKeep}>
          Keep
        </Button>
        <Button variant="plain" onClick={() => pending && onConfirm(pending)}>
          Remove exercise
        </Button>
      </div>
    </Sheet>
  );
}

function Fulfilled({ session, names, onDone }: { session: Session; names: Record<string, { name: string }>; onDone: () => void }) {
  const { title, subtitle } = splitWorkoutName(session.workoutName);
  const { done } = sessionProgress(session);
  return (
    <div className="log">
      <ScreenHeader title={title} subtitle={subtitle} />
      <Notice aria-label="Workout summary" className="summary">
        <p className="summary__stamp" role="status">
          Fulfilled
        </p>
        <p className="summary__meta">
          {shortDate(session.date)} · {done} {done === 1 ? "set" : "sets"} across {session.entries.length}{" "}
          {session.entries.length === 1 ? "exercise" : "exercises"}
        </p>
        <ul className="summary__list">
          {session.entries.map((e, i) => (
            <li key={`${e.exerciseId}-${i}`}>
              <span>{names[e.exerciseId]?.name ?? "Exercise"}</span>
              <span className="summary__sets">
                {e.sets.map((s) => (s.weight !== undefined ? `${s.weight}×${s.amount ?? "–"}` : `${s.amount ?? "–"}`)).join("  ")}
              </span>
            </li>
          ))}
        </ul>
      </Notice>
      <div className="fulfill-spacer" />
      <div className="fulfill-bar">
        <Button variant="primary" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
