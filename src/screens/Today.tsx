import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import { shortDate } from "../logic/clock";
import { splitWorkoutName } from "../logic/input";
import { addDays, WEEKDAYS, weekdayOf, type TodayPlan } from "../logic/schedule";
import { sessionProgress } from "../logic/session";
import type { Session, Workout } from "../logic/types";
import { useDb } from "../storage/DbContext";
import { useAuth } from "../sync/supabase";
import { X } from "lucide-react";
import { useToday } from "../ui/useToday";
import { discardWorkout, loadTodayState, startEmptyWorkout, startWorkout } from "../storage/repo";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Notice";
import { ScreenHeader } from "../ui/ScreenHeader";
import { Sheet } from "../ui/Sheet";

type Props = { onOpenLog: (sessionId: string) => void };

function exerciseCount(w: Workout): string {
  return `${w.exercises.length} ${w.exercises.length === 1 ? "exercise" : "exercises"}`;
}

const NUDGE_KEY = "backup-reminder-dismissed";
const readFlag = (key: string) => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};
const writeFlag = (key: string) => {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Storage unavailable: the nudge just comes back next time.
  }
};

const titleOf = (w?: Workout) => (w ? splitWorkoutName(w.name).title : "Workout");

/** "Next: Upper B, Thursday", or "tomorrow" when it is. */
function nextLine(plan: TodayPlan, today: string, byId: Map<string, Workout>): string | undefined {
  if (!plan.next) return undefined;
  const when = plan.next.date === addDays(today, 1) ? "tomorrow" : WEEKDAYS[weekdayOf(plan.next.date)];
  return `Next: ${titleOf(byId.get(plan.next.workoutId))}, ${when}`;
}

export function Today({ onOpenLog }: Props) {
  const db = useDb();
  const today = useToday();
  const auth = useAuth();
  const [nudgeHidden, setNudgeHidden] = useState(() => readFlag(NUDGE_KEY));
  const state = useLiveQuery(() => loadTodayState(db, today), [db, today]);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [starting, setStarting] = useState(false);
  /** Set synchronously, so a fast double tap can't start two workouts before the screen re-renders. */
  const startingNow = useRef(false);
  const [picking, setPicking] = useState(false);

  const begin = async (create: () => Promise<string>) => {
    if (startingNow.current) return;
    startingNow.current = true;
    setStarting(true);
    try {
      onOpenLog(await create());
    } catch (err) {
      console.error("Couldn't start the workout", err);
    } finally {
      startingNow.current = false;
      setStarting(false);
    }
  };
  const start = (workoutId: string) => begin(() => startWorkout(db, workoutId));

  if (!state) return <ScreenHeader title="Today" />;

  const { inProgress, workouts, plan, lastDateByWorkout } = state;
  const byId = new Map(workouts.map((w) => [w.id, w]));
  const todays = plan.today ? byId.get(plan.today.workoutId) : undefined;
  const next = nextLine(plan, today, byId);

  return (
    <>
      <ScreenHeader title="Today" />

      {auth.status === "signed-out" && !nudgeHidden && (
        <div className="backup-nudge">
          <p>Your workouts aren't backed up yet. Sign in under Settings.</p>
          <button
            type="button"
            className="backup-nudge__close"
            aria-label="Dismiss"
            onClick={() => {
              writeFlag(NUDGE_KEY);
              setNudgeHidden(true);
            }}
          >
            <X size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      )}

      {inProgress ? (
        <InProgress session={inProgress} onResume={() => onOpenLog(inProgress.id)} onDiscard={() => setConfirmDiscard(true)} />
      ) : todays && plan.today ? (
        <TodayNotice
          workout={todays}
          weekday={WEEKDAYS[plan.weekday]}
          status={plan.today.status}
          doneOn={plan.today.doneOn}
          next={next}
          lastDate={lastDateByWorkout[todays.id]}
          starting={starting}
          onStart={() => start(todays.id)}
        />
      ) : plan.next ? (
        <Notice aria-label="Rest day">
          <p className="contract__meta">{WEEKDAYS[plan.weekday]}</p>
          <h2 className="contract__title">Rest day</h2>
          <p className="contract__subtitle">{next}</p>
        </Notice>
      ) : (
        <Notice>
          <p className="empty-text">
            {workouts.length === 0 ? "No workouts yet. Add one under Workouts and it shows up here." : "No workouts scheduled. Set your week on the Workouts tab."}
          </p>
        </Notice>
      )}

      {!inProgress && (
        <div className="board-actions board-actions--end">
          <Button variant="text-board" onClick={() => setPicking(true)} disabled={starting}>
            Start a different workout
          </Button>
        </div>
      )}

      <Sheet open={picking} onClose={() => setPicking(false)} title="Start a workout">
        <ul className="picker__list start-list">
          {workouts.map((w) => {
            const { title, subtitle } = splitWorkoutName(w.name);
            return (
              <li key={w.id}>
                <button type="button" className="picker__option" disabled={starting} onClick={() => start(w.id)}>
                  <span className="picker__name">{title}</span>
                  {subtitle && <span className="picker__unit">{subtitle}</span>}
                </button>
              </li>
            );
          })}
          <li>
            <button type="button" className="picker__option" disabled={starting} onClick={() => begin(() => startEmptyWorkout(db))}>
              <span className="picker__name">Empty workout</span>
            </button>
          </li>
        </ul>
      </Sheet>

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

type TodayNoticeProps = {
  workout: Workout;
  weekday: string;
  status: "todo" | "doneToday" | "doneThisWeek";
  doneOn?: string;
  next?: string;
  lastDate?: string;
  starting: boolean;
  onStart: () => void;
};

/** Today's scheduled workout: ready to start, or already done with what's next. */
function TodayNotice({ workout, weekday, status, doneOn, next, lastDate, starting, onStart }: TodayNoticeProps) {
  const { title, subtitle } = splitWorkoutName(workout.name);
  return (
    <Notice aria-label={`Today: ${title}`}>
      <p className="contract__meta">
        <span>Today · {weekday}</span>
        {status === "todo" && (
          <>
            {" · "}
            <span>{exerciseCount(workout)}</span>
            {lastDate && (
              <>
                {" · "}
                <span>last {shortDate(lastDate)}</span>
              </>
            )}
          </>
        )}
      </p>
      <h2 className="contract__title">{title}</h2>
      {subtitle && <p className="contract__subtitle">{subtitle}</p>}
      {status === "todo" ? (
        <div className="contract__action">
          <Button variant="primary" onClick={onStart} loading={starting} loadingLabel="Starting…">
            Start workout
          </Button>
          {next && <p className="contract__next">{next}</p>}
        </div>
      ) : (
        <div className="contract__done">
          <p className="contract__done-status">{status === "doneToday" ? "Done today" : `Done this week (${WEEKDAYS[weekdayOf(doneOn!)]})`}</p>
          {next && <p className="contract__subtitle">{next}</p>}
        </div>
      )}
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
            {done} of {total} {total === 1 ? "set" : "sets"}
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
