export { filterCommonSlots, generateTimeSlots, type TimeSlot, type Unavailability } from './freetime';
export type TimeSlot = { start: string; end: string };

function isoToDate(s: string) {
  return new Date(s);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

export function generateSlots(startDate: Date, days = 7, slotMinutes = 30, fromHour = 8, toHour = 22) {
  const slots: TimeSlot[] = [];
  for (let d = 0; d < days; d++) {
    const day = new Date(startDate);
    day.setDate(day.getDate() + d);
    day.setHours(0, 0, 0, 0);

    for (let h = fromHour; h < toHour; h++) {
      for (let m = 0; m < 60; m += slotMinutes) {
        const s = new Date(day);
        s.setHours(h, m, 0, 0);
        const e = new Date(s);
        e.setMinutes(e.getMinutes() + slotMinutes);
        slots.push({ start: s.toISOString(), end: e.toISOString() });
      }
    }
  }
  return slots;
}

// availabilities are periods when user is NOT available
export function filterCommonSlots(
  slots: TimeSlot[],
  usersUnavailable: { user_id: string; ranges: { start: string; end: string }[] }[]
) {
  return slots.filter((slot) => {
    const s = isoToDate(slot.start);
    const e = isoToDate(slot.end);

    // if any user has a range overlapping the slot, the slot is NOT common
    for (const user of usersUnavailable) {
      for (const r of user.ranges) {
        const rs = isoToDate(r.start);
        const re = isoToDate(r.end);
        if (overlaps(s, e, rs, re)) return false;
      }
    }
    return true;
  });
}
