import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { cleanName, findExerciseByName, normalizeName } from "../logic/editing";
import { unitFor } from "../logic/format";
import type { Exercise, Measure } from "../logic/types";
import { useDb } from "../storage/DbContext";
import { getOrCreateExercise, loadExercises } from "../storage/repo";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

type Props = {
  open: boolean;
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
};

/**
 * Search the exercises, or create one. A name that already exists (ignoring case
 * and spaces) is never created twice, so an exercise keeps one history.
 */
export function ExercisePicker({ open, onPick, onClose }: Props) {
  const db = useDb();
  const exercises = useLiveQuery(() => loadExercises(db), [db]);
  const [query, setQuery] = useState("");
  const [measure, setMeasure] = useState<Measure>("reps");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setMeasure("reps");
  }, [open]);

  const list = exercises ?? [];
  const wanted = normalizeName(query);
  const matches = wanted ? list.filter((e) => normalizeName(e.name).includes(wanted)) : list;
  const name = cleanName(query);
  const canCreate = name !== "" && !findExerciseByName(list, name);

  const create = async () => {
    setCreating(true);
    try {
      onPick(await getOrCreateExercise(db, name, measure));
    } catch (err) {
      console.error("Couldn't save", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Add exercise" className="sheet--tall">
      <input
        className="field picker__search"
        type="search"
        aria-label="Search exercises"
        placeholder="Search, or type a new name"
        autoComplete="off"
        enterKeyHint="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="picker__scroll">
        {matches.length > 0 && (
          <ul className="picker__list">
            {matches.map((e) => (
              <li key={e.id}>
                <button type="button" className="picker__option" onClick={() => onPick(e)}>
                  <span className="picker__name">{e.name}</span>
                  <span className="picker__unit">{unitFor(e.measure)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {canCreate && (
          <div className="picker__create">
            {matches.length === 0 && <p className="sheet__body">No exercise matches “{name}”.</p>}
            <div className="form-field">
              <span className="form-field__label" id="picker-measure">
                Measured in
              </span>
              <div className="segmented" role="group" aria-labelledby="picker-measure">
                {(["reps", "seconds"] as const).map((m) => (
                  <button key={m} type="button" className="segmented__option" aria-pressed={measure === m} onClick={() => setMeasure(m)}>
                    {m === "reps" ? "Reps" : "Seconds"}
                  </button>
                ))}
              </div>
            </div>
            <Button variant="outline" onClick={create} loading={creating}>
              Create “{name}”
            </Button>
          </div>
        )}

        {!canCreate && matches.length === 0 && exercises && (
          <p className="sheet__body">No exercises yet. Type a name to create one.</p>
        )}
      </div>

      <div className="picker__footer">
        <Button variant="text" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}
