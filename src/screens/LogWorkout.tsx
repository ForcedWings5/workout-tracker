import { Trash2 } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { shortDate } from "../logic/clock";
import { describeSet, formatElapsed } from "../logic/format";
import { splitWorkoutName } from "../logic/input";
import { recordSets } from "../logic/progress";
import { sessionProgress } from "../logic/session";
import type { Measure, Session } from "../logic/types";
import { useDb } from "../storage/DbContext";
import {
  addExerciseToSession,
  addSet,
  deleteSession,
  deleteSessionSet,
  discardWorkout,
  finishWorkout,
  loadLogState,
  removeSessionEntry,
  renameSession,
  type SessionStatus,
  setNote,
  setSessionDate,
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

type Props = {
  sessionId: string;
  onClose: () => void;
  /** "edit" opens a finished session from history: a date field, no timer, "Done" instead of "Fulfill contract". */
  mode?: "live" | "edit";
  /** The back link's label. */
  backLabel?: string;
};

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
function useElapsed(sessionId: string, running: boolean, track = true): number {
  const key = `workout-timer:${sessionId}`;
  const [startedAt] = useState(() => {
    // A past session opened from history has no timer, so it never starts one.
    if (!track) return Date.now();
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

export function LogWorkout({ sessionId, onClose, mode = "live", backLabel = "Today" }: Props) {
  const db = useDb();
  const state = useLiveQuery(() => loadLogState(db, sessionId), [db, sessionId]);
  const [fulfilled, setFulfilled] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState<PendingDelete>();
  /** A confirmed delete hasn't reached the screen yet. */
  const [deleteBusy, setDeleteBusy] = useState(false);
  const scrollNext = useRef(false);
  const session = state?.session;
  const editing = mode === "edit";
  /** Every write says which kind of session it's for, so a past session is only changed from history. */
  const status: SessionStatus = editing ? "finished" : "in_progress";
  const elapsed = useElapsed(sessionId, !editing && !fulfilled, !editing);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState(false);

  // The confirmed delete has landed (or anything else changed the session): delete buttons are safe again.
  useEffect(() => setDeleteBusy(false), [session]);

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
  const records = recordSets(session, state.exercises, state.sessions);

  if (fulfilled) return <Fulfilled session={session} names={state.exercises} onDone={onClose} />;

  // The toggle is computed from the stored set inside the write, so two quick taps cancel out.
  const toggle = (entryIndex: number, setIndex: number) =>
    run(
      toggleSetDone(db, sessionId, entryIndex, setIndex, status).then((done) => {
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
        back={{ label: backLabel, onClick: onClose }}
        right={
          <div className="log__corner">
            {!editing && (
              <span className="log__timer" aria-label={`Elapsed ${formatElapsed(elapsed)}`}>
                {formatElapsed(elapsed)}
              </span>
            )}
            {/* One button for both states, so focus stays on it as it switches. */}
            <button
              type="button"
              className={deleting ? "btn btn--text-board" : "btn btn--text-board log__trash"}
              aria-label={deleting ? "Done deleting" : "Delete sets or exercises"}
              onClick={() => setDeleting(!deleting)}
            >
              {deleting ? "Done" : <Trash2 size={22} strokeWidth={2} aria-hidden="true" />}
            </button>
          </div>
        }
        title={title}
        subtitle={headerSubtitle}
      />

      {/* Always mounted, so screen readers announce the hint when it appears. */}
      <p className="visually-hidden" role="status">
        {deleting ? "Tap a set or exercise to delete it." : ""}
      </p>
      {deleting && (
        <Notice aria-hidden="true">
          <p className="empty-text">Tap a set or exercise to delete it.</p>
        </Notice>
      )}

      {(editing || !session.workoutId) && (
        <Notice aria-label="Workout">
          {!session.workoutId && (
            <TextField label="Workout name" value={session.workoutName} disabled={deleting} onCommit={(text) => renameSession(db, sessionId, text, status)} />
          )}
          {editing && (
            <label className="form-field">
              <span className="form-field__label">Date</span>
              <input
                className="field"
                type="date"
                value={session.date}
                disabled={deleting}
                onChange={(e) => run(setSessionDate(db, sessionId, e.target.value))}
              />
            </label>
          )}
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
            lastNote={editing ? undefined : state.lastNotes[entry.exerciseId]}
            isRecord={(s) => records.has(`${i}:${s}`)}
            currentSet={current?.entry === i ? current.set : undefined}
            onPatchSet={(s, patch) => run(updateSet(db, sessionId, i, s, patch, status))}
            onToggleSet={(s) => toggle(i, s)}
            onSkipSet={(s) => run(skipOrRemoveSet(db, sessionId, i, s, status))}
            onAddSet={() => run(addSet(db, sessionId, i, status))}
            onNote={(note) => run(setNote(db, sessionId, i, note, status))}
            deleting={deleting}
            onDeleteSet={(s) => setPending({ kind: "set", entry: i, set: s, exerciseId: entry.exerciseId })}
            onRemove={() => setPending({ kind: "entry", entry: i, exerciseId: entry.exerciseId })}
            deleteBusy={deleteBusy}
          />
        );
      })}

      <div className="board-actions">
        <Button variant="board" disabled={deleting} onClick={() => setPicking(true)}>
          Add exercise
        </Button>
        {editing && (
          <Button variant="text-board" disabled={deleting} onClick={() => setConfirmDeleteSession(true)}>
            Delete session
          </Button>
        )}
      </div>

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(exercise) => {
          setPicking(false);
          run(addExerciseToSession(db, sessionId, exercise.id, status));
        }}
      />

      <div className="fulfill-spacer" />
      <div className="fulfill-bar">
        {editing ? (
          <Button variant="primary" disabled={deleting} onClick={onClose}>
            Done
          </Button>
        ) : (
          <Button variant="primary" disabled={deleting} onClick={fulfill} loading={finishing}>
            Fulfill contract
          </Button>
        )}
      </div>

      <DeleteSheet
        pending={pending}
        session={session}
        names={state.exercises}
        scope={editing ? "this session" : "today"}
        onKeep={() => setPending(undefined)}
        onConfirm={(p) => {
          setPending(undefined);
          setDeleteBusy(true);
          const write =
            p.kind === "set"
              ? deleteSessionSet(db, sessionId, p.entry, p.set, p.exerciseId, status)
              : removeSessionEntry(db, sessionId, p.entry, p.exerciseId, status);
          run(
            write.catch((err: unknown) => {
              setDeleteBusy(false);
              throw err;
            }),
          );
        }}
      />

      <Sheet open={confirmDeleteSession} onClose={() => setConfirmDeleteSession(false)} title="Delete this session?">
        <p className="sheet__body">Its sets come out of your history. This can't be undone.</p>
        <div className="sheet__actions">
          <Button variant="outline" onClick={() => setConfirmDeleteSession(false)}>
            Keep session
          </Button>
          <Button
            variant="plain"
            onClick={async () => {
              await deleteSession(db, sessionId);
              setConfirmDeleteSession(false);
              onClose();
            }}
          >
            Delete session
          </Button>
        </div>
      </Sheet>

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

/** Confirms one delete in delete mode. Only this session changes. */
function DeleteSheet({
  pending,
  session,
  names,
  scope,
  onKeep,
  onConfirm,
}: {
  pending?: PendingDelete;
  session: Session;
  names: Record<string, { name: string; measure: Measure }>;
  /** "today" for the live workout, "this session" for a past one. */
  scope: string;
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
    <Sheet open={pending?.kind === "entry"} onClose={onKeep} title={`Remove ${name} from ${scope}?`}>
      <p className="sheet__body">Its sets from {scope} go too.</p>
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
