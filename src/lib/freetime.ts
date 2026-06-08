import { addDays, addMonths, addWeeks, endOfDay, endOfMonth, endOfWeek, format, startOfDay, startOfMonth, startOfWeek } from 'date-fns';

export type TimeSlot = { start: string; end: string };
export type Unavailability = { member_name: string; ranges: { start: string; end: string }[] };
export type PeriodView = 'day' | 'week' | 'month';
export type PeriodWindow = {
  key: string;
  label: string;
  start: string;
  end: string;
};
export type AvailabilityPeriod = PeriodWindow & {
  blockedMembers: string[];
  availableMembers: string[];
  totalMembers: number;
  blockedCount: number;
  fullyFree: boolean;
};

function toDate(value: string) {
  return new Date(value);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

export function generateTimeSlots(
  startDate: Date,
  days = 7,
  slotMinutes = 30,
  fromHour = 8,
  toHour = 22
) {
  const slots: TimeSlot[] = [];

  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const day = new Date(startDate);
    day.setDate(day.getDate() + dayIndex);
    day.setHours(0, 0, 0, 0);

    for (let hour = fromHour; hour < toHour; hour += 1) {
      for (let minute = 0; minute < 60; minute += slotMinutes) {
        const start = new Date(day);
        start.setHours(hour, minute, 0, 0);
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + slotMinutes);
        slots.push({ start: start.toISOString(), end: end.toISOString() });
      }
    }
  }

  return slots;
}

function getPeriodRange(baseDate: Date, view: PeriodView, index: number) {
  if (view === 'day') {
    const start = startOfDay(addDays(baseDate, index));
    return { start, end: endOfDay(start) };
  }

  if (view === 'month') {
    const start = startOfMonth(addMonths(baseDate, index));
    return { start, end: endOfMonth(start) };
  }

  const start = startOfWeek(addWeeks(baseDate, index), { weekStartsOn: 1 });
  return { start, end: endOfWeek(start, { weekStartsOn: 1 }) };
}

function getPeriodLabel(start: Date, view: PeriodView) {
  if (view === 'day') {
    return format(start, 'EEE dd MMM');
  }

  if (view === 'month') {
    return format(start, 'MMM yyyy');
  }

  return `Semaine du ${format(start, 'dd MMM')}`;
}

export function buildPeriodWindows(baseDate: Date, view: PeriodView, count = 7): PeriodWindow[] {
  return Array.from({ length: count }, (_, index) => {
    const range = getPeriodRange(baseDate, view, index);
    return {
      key: `${view}-${index}`,
      label: getPeriodLabel(range.start, view),
      start: range.start.toISOString(),
      end: range.end.toISOString()
    };
  });
}

export function buildAvailabilityPeriods(
  members: string[],
  unavailabilities: Unavailability[],
  view: PeriodView = 'week',
  count = 7,
  baseDate = new Date()
) {
  const windows = buildPeriodWindows(baseDate, view, count);

  return windows.map((window) => {
    const windowStart = toDate(window.start);
    const windowEnd = toDate(window.end);

    const blockedMembers = members.filter((memberName) =>
      unavailabilities.some((member) =>
        member.member_name === memberName &&
        member.ranges.some((range) => overlaps(windowStart, windowEnd, toDate(range.start), toDate(range.end)))
      )
    );

    const availableMembers = members.filter((memberName) => !blockedMembers.includes(memberName));

    return {
      ...window,
      blockedMembers,
      availableMembers,
      totalMembers: members.length,
      blockedCount: blockedMembers.length,
      fullyFree: blockedMembers.length === 0
    } satisfies AvailabilityPeriod;
  });
}

export function filterCommonSlots(slots: TimeSlot[], unavailabilities: Unavailability[]) {
  return slots.filter((slot) => {
    const slotStart = toDate(slot.start);
    const slotEnd = toDate(slot.end);

    for (const member of unavailabilities) {
      for (const range of member.ranges) {
        if (overlaps(slotStart, slotEnd, toDate(range.start), toDate(range.end))) {
          return false;
        }
      }
    }

    return true;
  });
}
