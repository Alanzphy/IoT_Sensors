import { useState } from "react";
import { startOfDay } from "date-fns";
import { quickRangeDates, type DateRangeMode } from "../utils/readingFilters";

// The owning screen is keyed by area; changing area also clears the selected cycle.
export function useReadingFilters() {
  const [range, setRange] = useState(() => ({ ...quickRangeDates("Últimos 7 días"), mode: "Últimos 7 días" as DateRangeMode }));
  const [cycleId, setCycleId] = useState<number>();
  const [page, setPage] = useState(1);
  const setPreset = (mode: DateRangeMode) => {
    setRange((previous) => mode === "Personalizado" ? { ...previous, mode } : { ...quickRangeDates(mode), mode });
    setPage(1);
  };
  const setStart = (date: Date) => {
    const start = startOfDay(date);
    setRange((previous) => ({ start, end: start > previous.end ? start : previous.end, mode: "Personalizado" }));
    setPage(1);
  };
  const setEnd = (date: Date) => {
    const end = startOfDay(date);
    setRange((previous) => ({ start: end < previous.start ? end : previous.start, end, mode: "Personalizado" }));
    setPage(1);
  };
  const selectCycle = (id?: number) => { setCycleId(id); setPage(1); };
  return { startDate: range.start, endDate: range.end, preset: range.mode, onPresetChange: setPreset,
    onStartDateChange: setStart, onEndDateChange: setEnd, cycleId, onCycleChange: selectCycle, page, setPage };
}
