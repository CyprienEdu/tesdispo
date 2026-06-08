'use client';

import {
  addDays,
  addMonths,
  addYears,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  startOfMonth,
  startOfWeek,
  startOfYear
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export type CalendarView = 'month' | 'week' | 'year';

export type AvailabilityRange = {
  id: string;
  member_name: string;
  start_ts: string;
  end_ts: string;
  note?: string | null;
};

type Props = {
  view: CalendarView;
  anchorDate: Date;
  ranges: AvailabilityRange[];
  currentMemberName: string;
  onViewChange: (view: CalendarView) => void;
  onAnchorDateChange: (nextDate: Date) => void;
  onCreateRange: (start: Date, end: Date) => Promise<void> | void;
};

function normalizeDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function dayLabel(date: Date) {
  return format(date, 'EEE d');
}

function isPastDate(date: Date) {
  return normalizeDay(date).getTime() < normalizeDay(new Date()).getTime();
}

function rangeOverlapsDay(range: AvailabilityRange, date: Date) {
  const dayStart = normalizeDay(date);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const rangeStart = new Date(range.start_ts);
  const rangeEnd = new Date(range.end_ts);
  return rangeStart < dayEnd && rangeEnd > dayStart;
}

export function AvailabilityCalendar({
  view,
  anchorDate,
  ranges,
  currentMemberName,
  onViewChange,
  onAnchorDateChange,
  onCreateRange
}: Props) {
  const [dragStart, setDragStart] = useState<Date | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Date | null>(null);

  const today = useMemo(() => normalizeDay(new Date()), []);

  const orderedMonthDates = useMemo(() => {
    const baseMonth = startOfMonth(anchorDate);
    const firstCell = startOfWeek(baseMonth, { weekStartsOn: 1 });
    const lastCell = endOfWeek(endOfMonth(baseMonth), { weekStartsOn: 1 });
    const days: Date[] = [];
    let cursor = new Date(firstCell);

    while (cursor <= lastCell) {
      days.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }

    return days;
  }, [anchorDate]);

  const weekDates = useMemo(() => {
    const firstDay = startOfWeek(anchorDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, index) => addDays(firstDay, index));
  }, [anchorDate]);

  const yearMonths = useMemo(() => {
    const firstDay = startOfYear(anchorDate);
    return Array.from({ length: 12 }, (_, index) => addMonths(firstDay, index));
  }, [anchorDate]);

  useEffect(() => {
    const stopDragging = async () => {
      if (!dragStart || !dragCurrent) {
        setDragStart(null);
        setDragCurrent(null);
        return;
      }

      const rangeStart = normalizeDay(dragStart < dragCurrent ? dragStart : dragCurrent);
      const rangeEnd = normalizeDay(dragStart > dragCurrent ? dragStart : dragCurrent);
      rangeEnd.setHours(23, 59, 59, 999);

      await onCreateRange(rangeStart, rangeEnd);
      setDragStart(null);
      setDragCurrent(null);
    };

    window.addEventListener('mouseup', stopDragging);
    window.addEventListener('touchend', stopDragging);

    return () => {
      window.removeEventListener('mouseup', stopDragging);
      window.removeEventListener('touchend', stopDragging);
    };
  }, [dragCurrent, dragStart, onCreateRange]);

  function setRange(date: Date) {
    if (isPastDate(date)) return;
    setDragStart(date);
    setDragCurrent(date);
  }

  function extendRange(date: Date) {
    if (!dragStart || isPastDate(date)) return;
    setDragCurrent(date);
  }

  function renderDayCell(date: Date) {
    const dayRanges = ranges.filter((range) => rangeOverlapsDay(range, date));
    const ownedRanges = dayRanges.filter((range) => range.member_name === currentMemberName);
    const otherRanges = dayRanges.filter((range) => range.member_name !== currentMemberName);
    const blocked = dayRanges.length > 0;
    const selected =
      dragStart && dragCurrent
        ? date >= normalizeDay(dragStart < dragCurrent ? dragStart : dragCurrent) &&
          date <= normalizeDay(dragStart > dragCurrent ? dragStart : dragCurrent)
        : false;
    const past = isPastDate(date) && !isSameDay(date, today);

    return (
      <button
        key={date.toISOString()}
        type="button"
        onMouseDown={() => setRange(date)}
        onMouseEnter={() => extendRange(date)}
        disabled={past}
        className={`group min-h-24 rounded-2xl border p-3 text-left transition ${
          past
            ? 'cursor-not-allowed border-white/5 bg-white/3 text-slate-500'
            : selected
              ? 'border-emerald-300/40 bg-emerald-300/10 text-white'
              : blocked
                ? ownedRanges.length > 0
                  ? 'border-rose-300/40 bg-rose-400/20 text-white'
                  : 'border-rose-300/20 bg-rose-400/10 text-white'
                : 'border-white/10 bg-white/5 text-slate-100 hover:bg-white/10'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-current/60">{dayLabel(date)}</p>
            <p className="mt-2 text-lg font-semibold">{format(date, 'd')}</p>
          </div>
          {isSameDay(date, today) ? (
            <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-100">
              Today
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-1">
          {blocked ? (
            <span className="rounded-full border border-white/10 bg-slate-950/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]">
              {ownedRanges.length > 0 ? 'Your busy' : 'Busy'}
            </span>
          ) : (
            <span className="rounded-full border border-white/10 bg-slate-950/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]">
              Free
            </span>
          )}
          {otherRanges.length > 0 ? (
            <span className="rounded-full border border-white/10 bg-slate-950/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]">
              {otherRanges.length} guest(s)
            </span>
          ) : null}
        </div>
      </button>
    );
  }

  const canGoBack =
    view === 'month'
      ? startOfMonth(anchorDate).getTime() > startOfMonth(today).getTime()
      : view === 'week'
        ? startOfWeek(anchorDate, { weekStartsOn: 1 }).getTime() > startOfWeek(today, { weekStartsOn: 1 }).getTime()
        : startOfYear(anchorDate).getTime() > startOfYear(today).getTime();

  function move(delta: number) {
    if (view === 'month') {
      const nextDate = addMonths(anchorDate, delta);
      if (startOfMonth(nextDate).getTime() < startOfMonth(today).getTime()) return;
      onAnchorDateChange(nextDate);
    } else if (view === 'week') {
      const nextDate = addDays(anchorDate, delta * 7);
      if (startOfWeek(nextDate, { weekStartsOn: 1 }).getTime() < startOfWeek(today, { weekStartsOn: 1 }).getTime()) return;
      onAnchorDateChange(nextDate);
    } else {
      const nextDate = addYears(anchorDate, delta);
      if (startOfYear(nextDate).getTime() < startOfYear(today).getTime()) return;
      onAnchorDateChange(nextDate);
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Calendrier</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">
            {view === 'month'
              ? format(anchorDate, 'MMMM yyyy')
              : view === 'week'
                ? `${format(startOfWeek(anchorDate, { weekStartsOn: 1 }), 'dd MMM')} - ${format(endOfWeek(anchorDate, { weekStartsOn: 1 }), 'dd MMM yyyy')}`
                : format(anchorDate, 'yyyy')}
          </h3>
          <p className="mt-2 text-sm text-slate-300">
            Clique sur un jour ou fais un glisser deposer pour marquer une indisponibilite.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['month', 'week', 'year'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onViewChange(item)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                view === item
                  ? 'bg-emerald-400 text-slate-950'
                  : 'border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10'
              }`}
            >
              {item === 'month' ? 'Mois' : item === 'week' ? 'Semaine' : 'Annee'}
            </button>
          ))}

          <div className="ml-0 flex items-center gap-2 sm:ml-2">
            <button
              type="button"
              onClick={() => move(-1)}
              disabled={!canGoBack}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-white transition hover:bg-white/10"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {view === 'month' ? (
        <div className="mt-5">
          <div className="grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-[0.25em] text-slate-400">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => (
              <span key={`${day}-${index}`}>{day}</span>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-7 gap-2">
            {orderedMonthDates.map(renderDayCell)}
          </div>
        </div>
      ) : null}

      {view === 'week' ? (
        <div className="mt-5 grid gap-2 lg:grid-cols-7">
          {weekDates.map(renderDayCell)}
        </div>
      ) : null}

      {view === 'year' ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {yearMonths.map((monthDate) => {
            const disabled = isPastDate(endOfMonth(monthDate));
            const hasBusy = ranges.some((range) => {
              const monthStart = startOfMonth(monthDate);
              const monthEnd = endOfMonth(monthDate);
              const rangeStart = new Date(range.start_ts);
              const rangeEnd = new Date(range.end_ts);
              return rangeStart < monthEnd && rangeEnd > monthStart;
            });

            return (
              <button
                key={monthDate.toISOString()}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  onAnchorDateChange(monthDate);
                  onViewChange('month');
                }}
                className={`rounded-2xl border p-4 text-left transition ${
                  disabled
                    ? 'cursor-not-allowed border-white/5 bg-white/3 text-slate-500'
                    : hasBusy
                      ? 'border-rose-300/30 bg-rose-400/10 text-white'
                      : 'border-white/10 bg-white/5 text-slate-100 hover:bg-white/10'
                }`}
              >
                <p className="text-xs uppercase tracking-[0.25em] text-current/60">{format(monthDate, 'MMMM')}</p>
                <p className="mt-2 text-xl font-semibold">{format(monthDate, 'yyyy')}</p>
                <p className="mt-2 text-sm text-current/70">
                  {hasBusy ? 'Des indispos sont posees.' : 'Mois encore libre.'}
                </p>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
