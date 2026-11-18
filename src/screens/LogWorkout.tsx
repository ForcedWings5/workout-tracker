import { useLiveQuery } from "dexie-react-hooks";
import { splitWorkoutName } from "../logic/input";
import { useDb } from "../storage/DbContext";
import { loadLogState } from "../storage/repo";
import { Notice } from "../ui/Notice";
import { ScreenHeader } from "../ui/ScreenHeader";

type Props = { sessionId: string; onClose: () => void };

export function LogWorkout({ sessionId, onClose }: Props) {
  const db = useDb();
  const state = useLiveQuery(() => loadLogState(db, sessionId), [db, sessionId]);
  const session = state?.session;
  const { title, subtitle } = splitWorkoutName(session?.workoutName ?? "");

  return (
    <>
      <ScreenHeader back={{ label: "Today", onClick: onClose }} title={title} subtitle={subtitle} />
      {session?.entries.map((entry, i) => (
        <Notice key={`${entry.exerciseId}-${i}`}>
          <h2 className="exercise__name">{state?.exercises[entry.exerciseId]?.name ?? "Exercise"}</h2>
        </Notice>
      ))}
    </>
  );
}
