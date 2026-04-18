import { format, isAfter, isBefore, parseISO, startOfDay, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "./ui/utils";

type DateRangeSelectorVariant = "soft" | "bordered";

interface ReadingAvailabilityResponse {
  min_date: string | null;
  max_date: string | null;
  available_dates: string[];
}

interface ReadingDateRangeSelectorProps {
  startDate: Date;
  endDate: Date;
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
  irrigationAreaId?: number;
  variant?: DateRangeSelectorVariant;
  className?: string;
}

function toIsoDate(day: Date): string {
  return format(day, "yyyy-MM-dd");
}

export function ReadingDateRangeSelector({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  irrigationAreaId,
  variant = "soft",
  className,
}: ReadingDateRangeSelectorProps) {
  const [month, setMonth] = useState<Date>(startOfMonth(endDate));
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [minDate, setMinDate] = useState<Date | null>(null);
  const [maxDate, setMaxDate] = useState<Date | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  useEffect(() => {
    setMonth(startOfMonth(endDate));
  }, [endDate]);

  useEffect(() => {
    if (!irrigationAreaId) {
      setMinDate(null);
      setMaxDate(null);
      setAvailableDates([]);
      return;
    }

    let cancelled = false;

    const fetchAvailability = async () => {
      setLoadingAvailability(true);
      try {
        const params = new URLSearchParams({
          irrigation_area_id: irrigationAreaId.toString(),
          month_start: toIsoDate(startOfMonth(month)),
        });

        const res = await api.get<ReadingAvailabilityResponse>(`/readings/availability?${params}`);
        if (cancelled) return;

        setMinDate(res.data.min_date ? startOfDay(parseISO(res.data.min_date)) : null);
        setMaxDate(res.data.max_date ? startOfDay(parseISO(res.data.max_date)) : null);
        setAvailableDates(res.data.available_dates ?? []);
      } catch (error) {
        if (!cancelled) {
          setAvailableDates([]);
        }
        console.error("Failed to fetch reading availability", error);
      } finally {
        if (!cancelled) {
          setLoadingAvailability(false);
        }
      }
    };

    fetchAvailability();

    return () => {
      cancelled = true;
    };
  }, [irrigationAreaId, month]);

  const availableDateSet = useMemo(() => new Set(availableDates), [availableDates]);

  useEffect(() => {
    if (!minDate || !maxDate) return;

    let nextStart = startOfDay(startDate);
    let nextEnd = startOfDay(endDate);
    let changed = false;

    if (isBefore(nextStart, minDate)) {
      nextStart = minDate;
      changed = true;
    }

    if (isAfter(nextEnd, maxDate)) {
      nextEnd = maxDate;
      changed = true;
    }

    if (isAfter(nextStart, nextEnd)) {
      nextEnd = nextStart;
      changed = true;
    }

    if (changed) {
      onStartDateChange(nextStart);
      onEndDateChange(nextEnd);
    }
  }, [minDate, maxDate, startDate, endDate, onStartDateChange, onEndDateChange]);

  const isDayDisabled = (day: Date) => {
    const normalizedDay = startOfDay(day);
    if (minDate && isBefore(normalizedDay, minDate)) return true;
    if (maxDate && isAfter(normalizedDay, maxDate)) return true;
    return false;
  };

  const handleStartSelect = (date: Date | undefined) => {
    if (!date) return;
    const nextStart = startOfDay(date);
    onStartDateChange(nextStart);
    if (isAfter(nextStart, startOfDay(endDate))) {
      onEndDateChange(nextStart);
    }
    setStartOpen(false);
  };

  const handleEndSelect = (date: Date | undefined) => {
    if (!date) return;
    const nextEnd = startOfDay(date);
    onEndDateChange(nextEnd);
    if (isBefore(nextEnd, startOfDay(startDate))) {
      onStartDateChange(nextEnd);
    }
    setEndOpen(false);
  };

  const triggerBase = "w-full input-glass px-4 py-2.5 text-sm flex items-center gap-3 transition-colors duration-200 cursor-pointer";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>Fecha inicio</label>
          <Popover open={startOpen} onOpenChange={setStartOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={triggerBase}>
                <CalendarIcon className="h-4 w-4" style={{ color: "var(--accent-green)" }} />
                <span>{format(startDate, "dd/MM/yyyy")}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                locale={es}
                month={month}
                onMonthChange={setMonth}
                selected={startDate}
                onSelect={handleStartSelect}
                disabled={isDayDisabled}
                modifiers={{
                  available: (day) => availableDateSet.has(toIsoDate(day)),
                }}
                modifiersClassNames={{
                  available: "font-semibold text-[var(--accent-gold)] after:absolute after:bottom-1 after:left-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-[var(--accent-green)]",
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>Fecha fin</label>
          <Popover open={endOpen} onOpenChange={setEndOpen}>
            <PopoverTrigger asChild>
              <button type="button" className={triggerBase}>
                <CalendarIcon className="h-4 w-4" style={{ color: "var(--accent-green)" }} />
                <span>{format(endDate, "dd/MM/yyyy")}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                locale={es}
                month={month}
                onMonthChange={setMonth}
                selected={endDate}
                onSelect={handleEndSelect}
                disabled={isDayDisabled}
                modifiers={{
                  available: (day) => availableDateSet.has(toIsoDate(day)),
                }}
                modifiersClassNames={{
                  available: "font-semibold text-[var(--accent-gold)] after:absolute after:bottom-1 after:left-1/2 after:h-1.5 after:w-1.5 after:-translate-x-1/2 after:rounded-full after:bg-[var(--accent-green)]",
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
        {loadingAvailability && (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Cargando disponibilidad...
          </span>
        )}
        {!loadingAvailability && minDate && maxDate && (
          <span>
            Disponible desde {format(minDate, "dd MMM yyyy", { locale: es })} hasta {format(maxDate, "dd MMM yyyy", { locale: es })}
          </span>
        )}
        {!loadingAvailability && availableDates.length > 0 && (
          <span>Dias con lecturas en este mes: {availableDates.length}</span>
        )}
      </div>
    </div>
  );
}
