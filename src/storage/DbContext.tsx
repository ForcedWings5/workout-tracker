import { createContext, useContext, type ReactNode } from "react";
import { db as appDb, type WorkoutDB } from "./db";

const DbContext = createContext<WorkoutDB>(appDb);

/** Lets tests hand screens a fresh database. The app uses the default. */
export function DbProvider({ db, children }: { db: WorkoutDB; children: ReactNode }) {
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb(): WorkoutDB {
  return useContext(DbContext);
}
