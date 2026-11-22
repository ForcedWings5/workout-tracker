import { CircleMinus } from "lucide-react";
import { holdPercent, setLabel, targetHint, unitFor } from "../logic/format";
import { isRemovableSet } from "../logic/session";
import type { LoggedSet, Measure, PlannedExercise } from "../logic/types";
import { MarkBox, type MarkState } from "../ui/MarkBox";
import { NumberField } from "../ui/NumberField";

type Props = {
  index: number;
  set: LoggedSet;
  measure: Measure;
  planned: Omit<PlannedExercise, "exerciseId">;
  current: boolean;
  /** Beats every earlier done set of the exercise: shows a "Record" label. */
  record?: boolean;
  onPatch: (patch: Partial<LoggedSet>) => void;
  onToggle: () => void;
  onSkip: () => void;
  /** Delete mode: values become plain text and the mark box becomes a delete button. */
  deleting?: boolean;
  exerciseName: string;
  onDelete: () => void;
  /** A delete is still saving: hold off, so the next tap can't point at a row that's about to move. */
  deleteBusy?: boolean;
};

export function markStateOf(set: LoggedSet, current: boolean): MarkState {
  if (set.done) return "done";
  if (set.skipped) return "skipped";
  return current ? "current" : "suggested";
}

export function SetRow({ index, set, measure, planned, current, record = false, onPatch, onToggle, onSkip, deleting = false, exerciseName, onDelete, deleteBusy = false }: Props) {
  const n = index + 1;
  const state = markStateOf(set, current);
  const skipLabel = set.skipped
    ? `Restore set ${n}`
    : isRemovableSet(set, index, planned.sets)
      ? `Remove set ${n}`
      : `Skip set ${n}`;
  const target = targetHint(planned) ?? "–";
  const draft = !set.done;
  const holdBar = measure === "seconds" && (
    <div className="hold" aria-hidden="true">
      <div className="hold__fill" style={{ width: `${holdPercent(set.amount, planned)}%` }} />
    </div>
  );

  if (deleting) {
    return (
      <div className={`set set--${state}`}>
        <div className="set__row">
          <span className="set__n">{n}</span>
          <ReadOnlyNumber value={set.weight} unit="lb" draft={draft} struck={set.skipped} />
          <ReadOnlyNumber value={set.amount} unit={unitFor(measure)} draft={draft} struck={set.skipped} />
          <button type="button" className="btn btn--plain delete-btn" aria-label={`Delete set ${n} of ${exerciseName}`} disabled={deleteBusy} onClick={onDelete}>
            <CircleMinus size={24} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        {holdBar}
      </div>
    );
  }

  return (
    <div className={`set set--${state}`} data-current={current || undefined}>
      <div className="set__row">
        {set.done ? (
          // A done set can't be skipped by a stray tap; un-confirm it first.
          <span className="set__n">{n}</span>
        ) : (
          <button type="button" className="set__n" aria-label={skipLabel} onClick={onSkip}>
            {n}
          </button>
        )}
        <NumberField
          label={`Set ${n} weight`}
          value={set.weight}
          unit="lb"
          kind="weight"
          draft={draft}
          struck={set.skipped}
          placeholder="–"
          onCommit={(weight) => onPatch({ weight })}
        />
        <span className="set__amount">
          <NumberField
            label={`Set ${n} ${measure === "seconds" ? "seconds" : "reps"}`}
            value={set.amount}
            unit={unitFor(measure)}
            kind="amount"
            draft={draft}
            struck={set.skipped}
            placeholder={target}
            onCommit={(amount) => onPatch({ amount })}
          />
          {record && set.done && <span className="set__record">Record</span>}
        </span>
        <MarkBox state={state} label={setLabel(index, set, measure)} onToggle={onToggle} />
      </div>
      {holdBar}
    </div>
  );
}

/** A set's value shown as text in delete mode, laid out like the number field it replaces. */
function ReadOnlyNumber({ value, unit, draft, struck }: { value?: number; unit: string; draft: boolean; struck?: boolean }) {
  const classes = ["num", draft ? "num--draft" : "", struck ? "num--struck" : ""].filter(Boolean).join(" ");
  return (
    <span className={classes}>
      <span className="num__value">{value ?? "–"}</span>
      <span className="num__unit">{unit}</span>
    </span>
  );
}
