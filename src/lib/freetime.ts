export type TimeSlot = { start: string; end: string };
export type Unavailability = { member_name: string; ranges: { start: string; end: string }[] };

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
