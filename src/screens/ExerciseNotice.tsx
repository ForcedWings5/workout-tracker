import { CircleMinus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { shortDate } from "../logic/clock";
import { formatTarget } from "../logic/format";
import type { LoggedSet, Measure, SessionEntry } from "../logic/types";
import { Notice } from "../ui/Notice";
import { SetRow } from "./SetRow";

type Props = {
  name: string;
  measure: Measure;
  entry: SessionEntry;
  lastNote?: { date: string; note: string };
  /** Index of the session's current set in this entry, if it's here. */
  currentSet?: number;
  onPatchSet: (setIndex: number, patch: Partial<LoggedSet>) => void;
  onToggleSet: (setIndex: number) => void;
  onSkipSet: (setIndex: number) => void;
  onAddSet: () => void;
  onNote: (note: string) => void;
  /** Delete mode: sets and the exercise get delete buttons, everything else is inert. */
  deleting?: boolean;
  onDeleteSet: (setIndex: number) => void;
  onRemove: () => void;
  /** A delete is still saving. */
  deleteBusy?: boolean;
};

export function ExerciseNotice({
  name,
  measure,
  entry,
  lastNote,
  currentSet,
  onPatchSet,
  onToggleSet,
  onSkipSet,
  onAddSet,
  onNote,
  deleting = false,
  onDeleteSet,
  onRemove,
  deleteBusy = false,
}: Props) {
  return (
    <Notice aria-label={name} className="exercise">
      <div className={deleting ? "exercise__head exercise__head--deleting" : "exercise__head"}>
        <h2 className="exercise__name">{name}</h2>
        <span className="exercise__target">{formatTarget(entry.planned, measure)}</span>
        {deleting && (
          <button type="button" className="btn btn--plain delete-btn" aria-label={`Remove ${name} from today`} disabled={deleteBusy} onClick={onRemove}>
            <CircleMinus size={24} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>
      {lastNote && (
        <p className="last-note">
          <span className="last-note__date">{shortDate(lastNote.date)}</span>
          {" · "}
          <span>{lastNote.note}</span>
        </p>
      )}
      <div className="sets">
        {entry.sets.map((set, i) => (
          <SetRow
            key={i}
            index={i}
            set={set}
            measure={measure}
            planned={entry.planned}
            current={currentSet === i}
            onPatch={(patch) => onPatchSet(i, patch)}
            onToggle={() => onToggleSet(i)}
            onSkip={() => onSkipSet(i)}
            deleting={deleting}
            exerciseName={name}
            onDelete={() => onDeleteSet(i)}
            deleteBusy={deleteBusy}
          />
        ))}
      </div>
      <button type="button" className="btn btn--text exercise__add" aria-label={`Add a set to ${name}`} disabled={deleting} onClick={onAddSet}>
        <Plus size={20} strokeWidth={2} aria-hidden="true" />
        Set
      </button>
      <NoteField name={name} value={entry.note ?? ""} disabled={deleting} onCommit={onNote} />
    </Notice>
  );
}

function NoteField({ name, value, disabled, onCommit }: { name: string; value: string; disabled: boolean; onCommit: (note: string) => void }) {
  const [text, setText] = useState(value);
  const focused = useRef(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);

  // Grow with the text, one line at a time.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [text]);

  return (
    <textarea
      ref={ref}
      className="field exercise__note"
      rows={1}
      aria-label={`Note for ${name}`}
      placeholder="Add a note…"
      disabled={disabled}
      value={text}
      onFocus={() => (focused.current = true)}
      onChange={(e) => {
        // Saved on every keystroke, so a note survives the phone locking.
        setText(e.target.value);
        onCommit(e.target.value);
      }}
      onBlur={() => (focused.current = false)}
    />
  );
}
