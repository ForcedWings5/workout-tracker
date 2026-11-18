import { holdPercent, setLabel, unitFor } from "../logic/format";
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
  onPatch: (patch: Partial<LoggedSet>) => void;
  onToggle: () => void;
  onSkip: () => void;
};

export function markStateOf(set: LoggedSet, current: boolean): MarkState {
  if (set.done) return "done";
  if (set.skipped) return "skipped";
  return current ? "current" : "suggested";
}

export function SetRow({ index, set, measure, planned, current, onPatch, onToggle, onSkip }: Props) {
  const n = index + 1;
  const state = markStateOf(set, current);
  const skipLabel = set.skipped
    ? `Restore set ${n}`
    : isRemovableSet(set, index, planned.sets)
      ? `Remove set ${n}`
      : `Skip set ${n}`;
  const target = planned.targetMax !== undefined ? `${planned.targetMin}–${planned.targetMax}` : `${planned.targetMin}`;
  const draft = !set.done;

  return (
    <div className={`set set--${state}`} data-current={current || undefined}>
      <div className="set__row">
        <button type="button" className="set__n" aria-label={skipLabel} onClick={onSkip}>
          {n}
        </button>
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
        <MarkBox state={state} label={setLabel(index, set, measure)} onToggle={onToggle} />
      </div>
      {measure === "seconds" && (
        <div className="hold" aria-hidden="true">
          <div className="hold__fill" style={{ width: `${holdPercent(set.amount, planned)}%` }} />
        </div>
      )}
    </div>
  );
}
