import { useEffect, useState } from "react";
import { todayLocal } from "../logic/clock";

/** Today's local date, re-read whenever the app comes back to the foreground (it may have been open past midnight). */
export function useToday(): string {
  const [today, setToday] = useState(todayLocal);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setToday(todayLocal());
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return today;
}
