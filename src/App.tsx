import { useState } from "react";
import { EditWorkout } from "./screens/EditWorkout";
import { ExerciseHistory } from "./screens/ExerciseHistory";
import { LogWorkout } from "./screens/LogWorkout";
import { Progress } from "./screens/Progress";
import { Today } from "./screens/Today";
import { Workouts } from "./screens/Workouts";
import { Notice } from "./ui/Notice";
import { ScreenHeader } from "./ui/ScreenHeader";
import { TabBar, type Tab } from "./ui/TabBar";

type Overlay =
  | { kind: "log"; sessionId: string }
  | { kind: "editWorkout"; workoutId: string }
  | { kind: "exercise"; exerciseId: string }
  | { kind: "pastSession"; sessionId: string; exerciseId: string; exerciseName: string };
type View = { tab: Tab; overlay?: Overlay };

const COMING: Record<"settings", { title: string; text: string }> = {
  settings: { title: "Settings", text: "Backups arrive in a later update. Always open Workout Tracker from the home-screen icon." },
};

export default function App() {
  const [view, setView] = useState<View>({ tab: "today" });

  if (view.overlay?.kind === "log") {
    return (
      <div className="app">
        <LogWorkout sessionId={view.overlay.sessionId} onClose={() => setView({ tab: "today" })} />
      </div>
    );
  }

  if (view.overlay?.kind === "pastSession") {
    const { sessionId, exerciseId, exerciseName } = view.overlay;
    return (
      <div className="app">
        <LogWorkout
          key={sessionId}
          sessionId={sessionId}
          mode="edit"
          backLabel={exerciseName}
          onClose={() => setView({ tab: "progress", overlay: { kind: "exercise", exerciseId } })}
        />
      </div>
    );
  }

  if (view.overlay?.kind === "exercise") {
    const { exerciseId } = view.overlay;
    return (
      <div className="app">
        <main>
          <ExerciseHistory
            exerciseId={exerciseId}
            onBack={() => setView({ tab: "progress" })}
            onOpenSession={(sessionId, exerciseName) =>
              setView({ tab: "progress", overlay: { kind: "pastSession", sessionId, exerciseId, exerciseName } })
            }
          />
          <div className="tabbar-spacer" />
        </main>
        <TabBar active="progress" onChange={(tab) => setView({ tab })} />
      </div>
    );
  }

  if (view.overlay?.kind === "editWorkout") {
    return (
      <div className="app">
        <main>
          <EditWorkout workoutId={view.overlay.workoutId} onClose={() => setView({ tab: "workouts" })} />
        </main>
        <TabBar active="workouts" onChange={(tab) => setView({ tab })} />
      </div>
    );
  }

  return (
    <div className="app">
      <main>
        {view.tab === "today" ? (
          <Today onOpenLog={(sessionId) => setView({ tab: "today", overlay: { kind: "log", sessionId } })} />
        ) : view.tab === "progress" ? (
          <Progress onOpen={(exerciseId) => setView({ tab: "progress", overlay: { kind: "exercise", exerciseId } })} />
        ) : view.tab === "workouts" ? (
          <Workouts onEdit={(workoutId) => setView({ tab: "workouts", overlay: { kind: "editWorkout", workoutId } })} />
        ) : (
          <>
            <ScreenHeader title={COMING[view.tab].title} />
            <Notice>
              <p className="empty-text">{COMING[view.tab].text}</p>
            </Notice>
          </>
        )}
        <div className="tabbar-spacer" />
      </main>
      <TabBar active={view.tab} onChange={(tab) => setView({ tab })} />
    </div>
  );
}
