import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

type Group = {
  id: string;
  name: string;
  owner_name: string;
  created_at: string;
};

type GroupMember = {
  id: string;
  group_id: string;
  member_name: string;
  role: string;
  created_at: string;
};

type EventItem = {
  id: string;
  group_id: string;
  name: string;
  owner_name: string;
  resolved_at: string | null;
  archived_at: string | null;
  availability_start_ts?: string | null;
  availability_end_ts?: string | null;
  created_at: string;
};

type EventMember = {
  id: string;
  event_id: string;
  member_name: string;
  role: string;
  created_at: string;
};

type Availability = {
  id: string;
  scope_type: 'group' | 'event';
  scope_id: string;
  member_name: string;
  start_ts: string;
  end_ts: string;
  note: string | null;
  created_at: string;
};

type MockState = {
  groups: Group[];
  group_members: GroupMember[];
  events: EventItem[];
  event_members: EventMember[];
  availabilities: Availability[];
};

type GroupSummary = Group & {
  members?: GroupMember[];
  events?: EventItem[];
};

type EventSummary = EventItem & {
  members?: EventMember[];
  group_name?: string;
  group_owner_name?: string;
};

const storePath = path.join(process.cwd(), '.tesdispo.mock-db.json');

function nowIso() {
  return new Date().toISOString();
}

function createId() {
  return randomUUID();
}

function initialState(): MockState {
  return {
    groups: [],
    group_members: [],
    events: [],
    event_members: [],
    availabilities: []
  };
}

async function readState(): Promise<MockState> {
  try {
    const raw = await readFile(storePath, 'utf8');
    const data = JSON.parse(raw) as Partial<MockState>;
    return {
      groups: data.groups ?? [],
      group_members: data.group_members ?? [],
      events: data.events ?? [],
      event_members: data.event_members ?? [],
      availabilities: data.availabilities ?? []
    };
  } catch {
    return initialState();
  }
}

async function writeState(state: MockState) {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(state, null, 2), 'utf8');
}

let queue = Promise.resolve();

async function mutate<T>(handler: (state: MockState) => Promise<T> | T) {
  const task = queue.then(async () => {
    const state = await readState();
    const result = await handler(state);
    await writeState(state);
    return result;
  });

  queue = task.then(() => undefined, () => undefined);
  return task;
}

function normalizeMaybeIso(value: string | null | undefined) {
  return value ?? null;
}

export function isSchemaCacheError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const message = String((error as { message?: string }).message ?? '').toLowerCase();
  return message.includes('schema cache') || message.includes('relation "public.') || message.includes('couldn\'t find the table');
}

export async function listGroups() {
  return readState().then((state) => [...state.groups].sort((left, right) => right.created_at.localeCompare(left.created_at)));
}

export async function listGroupsByOwner(ownerName: string) {
  return (await listGroups()).filter((group) => group.owner_name === ownerName);
}

export async function listGroupsByMember(memberName: string) {
  const state = await readState();
  const groupIds = new Set(state.group_members.filter((member) => member.member_name === memberName).map((member) => member.group_id));
  return state.groups
    .filter((group) => groupIds.has(group.id) && group.owner_name !== memberName)
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export async function createGroup(name: string, ownerName: string, memberNames: string[]) {
  return mutate(async (state) => {
    const group: Group = { id: createId(), name, owner_name: ownerName, created_at: nowIso() };
    state.groups.unshift(group);

    const uniqueMembers = Array.from(new Set([ownerName, ...memberNames])).filter(Boolean);
    for (const memberName of uniqueMembers) {
      state.group_members.push({
        id: createId(),
        group_id: group.id,
        member_name: memberName,
        role: memberName === ownerName ? 'owner' : 'member',
        created_at: nowIso()
      });
    }

    return group;
  });
}

export async function getGroup(groupId: string) {
  const state = await readState();
  return state.groups.find((group) => group.id === groupId) ?? null;
}

export async function getGroupSummary(groupId: string): Promise<GroupSummary | null> {
  const state = await readState();
  const group = state.groups.find((item) => item.id === groupId);
  if (!group) return null;

  return {
    ...group,
    members: state.group_members.filter((member) => member.group_id === groupId),
    events: state.events.filter((event) => event.group_id === groupId)
  };
}

export async function listGroupMembers(groupId: string) {
  const state = await readState();
  return state.group_members
    .filter((member) => member.group_id === groupId)
    .sort((left, right) => left.created_at.localeCompare(right.created_at));
}

export async function addGroupMember(groupId: string, memberName: string) {
  return mutate(async (state) => {
    const existing = state.group_members.find((member) => member.group_id === groupId && member.member_name === memberName);
    if (existing) return existing;

    const group = state.groups.find((item) => item.id === groupId);
    const record: GroupMember = {
      id: createId(),
      group_id: groupId,
      member_name: memberName,
      role: group && group.owner_name === memberName ? 'owner' : 'member',
      created_at: nowIso()
    };

    state.group_members.push(record);
    return record;
  });
}

export async function deleteGroupMember(groupId: string, memberName: string) {
  return mutate(async (state) => {
    const deleted = state.group_members.filter((member) => member.group_id === groupId && member.member_name === memberName);
    state.group_members = state.group_members.filter((member) => !(member.group_id === groupId && member.member_name === memberName));

    const groupEventIds = new Set(state.events.filter((event) => event.group_id === groupId).map((event) => event.id));
    state.event_members = state.event_members.filter(
      (member) => !(groupEventIds.has(member.event_id) && member.member_name === memberName)
    );
    state.availabilities = state.availabilities.filter(
      (availability) =>
        !(
          availability.member_name === memberName &&
          ((availability.scope_type === 'group' && availability.scope_id === groupId) ||
            (availability.scope_type === 'event' && groupEventIds.has(availability.scope_id)))
        )
    );

    return deleted;
  });
}

export async function listEvents() {
  const state = await readState();
  return [...state.events].sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export async function listEventsByGroup(groupId: string) {
  const state = await readState();
  return state.events.filter((event) => event.group_id === groupId).sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export async function listEventMembers(eventId: string) {
  const state = await readState();
  return state.event_members
    .filter((member) => member.event_id === eventId)
    .sort((left, right) => left.created_at.localeCompare(right.created_at));
}

export async function createEvent(
  groupId: string,
  name: string,
  ownerName: string,
  resolvedAt: string | null,
  memberNames: string[],
  availabilityStartTs: string | null = null,
  availabilityEndTs: string | null = null
) {
  return mutate(async (state) => {
    const event: EventItem = {
      id: createId(),
      group_id: groupId,
      name,
      owner_name: ownerName,
      resolved_at: resolvedAt,
      archived_at: null,
      availability_start_ts: availabilityStartTs,
      availability_end_ts: availabilityEndTs,
      created_at: nowIso()
    };

    state.events.unshift(event);

    const uniqueMembers = Array.from(new Set([ownerName, ...memberNames])).filter(Boolean);
    for (const memberName of uniqueMembers) {
      state.event_members.push({
        id: createId(),
        event_id: event.id,
        member_name: memberName,
        role: memberName === ownerName ? 'owner' : 'member',
        created_at: nowIso()
      });
    }

    return event;
  });
}

export async function getEvent(eventId: string) {
  const state = await readState();
  return state.events.find((event) => event.id === eventId) ?? null;
}

export async function getEventSummary(eventId: string): Promise<EventSummary | null> {
  const state = await readState();
  const event = state.events.find((item) => item.id === eventId);
  if (!event) return null;

  const group = state.groups.find((item) => item.id === event.group_id);

  return {
    ...event,
    group_name: group?.name ?? '',
    group_owner_name: group?.owner_name ?? '',
    members: state.event_members.filter((member) => member.event_id === eventId)
  };
}

export async function addEventMember(eventId: string, memberName: string) {
  return mutate(async (state) => {
    const existing = state.event_members.find((member) => member.event_id === eventId && member.member_name === memberName);
    if (existing) return existing;

    const event = state.events.find((item) => item.id === eventId);
    const record: EventMember = {
      id: createId(),
      event_id: eventId,
      member_name: memberName,
      role: event && event.owner_name === memberName ? 'owner' : 'member',
      created_at: nowIso()
    };

    state.event_members.push(record);
    return record;
  });
}

export async function deleteEventMember(eventId: string, memberName: string) {
  return mutate(async (state) => {
    const deleted = state.event_members.filter((member) => member.event_id === eventId && member.member_name === memberName);
    state.event_members = state.event_members.filter((member) => !(member.event_id === eventId && member.member_name === memberName));
    state.availabilities = state.availabilities.filter(
      (availability) => !(availability.scope_type === 'event' && availability.scope_id === eventId && availability.member_name === memberName)
    );
    return deleted;
  });
}

export async function listAvailabilities(scopeType: 'group' | 'event', scopeId: string, memberName?: string) {
  const state = await readState();
  return state.availabilities
    .filter((availability) => availability.scope_type === scopeType && availability.scope_id === scopeId && (!memberName || availability.member_name === memberName))
    .sort((left, right) => left.start_ts.localeCompare(right.start_ts));
}

export async function createAvailability(input: {
  scope_type: 'group' | 'event';
  scope_id: string;
  member_name: string;
  start_ts: string;
  end_ts: string;
  note?: string | null;
}) {
  return mutate(async (state) => {
    const record: Availability = {
      id: createId(),
      scope_type: input.scope_type,
      scope_id: input.scope_id,
      member_name: input.member_name,
      start_ts: input.start_ts,
      end_ts: input.end_ts,
      note: normalizeMaybeIso(input.note) ?? null,
      created_at: nowIso()
    };

    state.availabilities.push(record);
    return record;
  });
}

export async function deleteAvailabilities(ids: string[], memberName?: string) {
  return mutate(async (state) => {
    const idSet = new Set(ids);
    const shouldDelete = (availability: Availability) => idSet.has(availability.id) && (!memberName || availability.member_name === memberName);
    const deleted = state.availabilities.filter(shouldDelete);
    state.availabilities = state.availabilities.filter((availability) => !shouldDelete(availability));
    return deleted;
  });
}

export async function resolveGroupsForEvents(eventIds: string[]) {
  const state = await readState();
  const groupById = new Map(state.groups.map((group) => [group.id, group.name]));
  return eventIds.reduce<Record<string, string>>((accumulator, eventId) => {
    const event = state.events.find((item) => item.id === eventId);
    if (event) {
      accumulator[eventId] = groupById.get(event.group_id) ?? '';
    }
    return accumulator;
  }, {});
}

export async function listEventsWithGroupNames() {
  const state = await readState();
  const groupById = new Map(state.groups.map((group) => [group.id, group.name]));
  return state.events
    .slice()
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map((event) => ({
      ...event,
      group_name: groupById.get(event.group_id) ?? ''
    }));
}

export async function deleteGroup(groupId: string) {
  return mutate(async (state) => {
    state.groups = state.groups.filter((group) => group.id !== groupId);
    state.group_members = state.group_members.filter((member) => member.group_id !== groupId);
    state.events = state.events.filter((event) => event.group_id !== groupId);
    state.event_members = state.event_members.filter((member) => state.events.some((event) => event.id === member.event_id));
    state.availabilities = state.availabilities.filter((availability) => availability.scope_id !== groupId);
  });
}

export async function updateGroup(groupId: string, name: string) {
  return mutate(async (state) => {
    const group = state.groups.find((item) => item.id === groupId);
    if (!group) return null;
    group.name = name;
    return group;
  });
}

export async function deleteEvent(eventId: string) {
  return mutate(async (state) => {
    state.events = state.events.filter((event) => event.id !== eventId);
    state.event_members = state.event_members.filter((member) => member.event_id !== eventId);
    state.availabilities = state.availabilities.filter((availability) => availability.scope_id !== eventId);
  });
}

export async function updateEvent(eventId: string, payload: { name?: string; resolved_at?: string | null; archived_at?: string | null; availability_start_ts?: string | null; availability_end_ts?: string | null }) {
  return mutate(async (state) => {
    const event = state.events.find((item) => item.id === eventId);
    if (!event) return null;
    if (payload.name !== undefined) event.name = payload.name;
    if (payload.resolved_at !== undefined) event.resolved_at = payload.resolved_at;
    if (payload.archived_at !== undefined) event.archived_at = payload.archived_at;
    if (payload.availability_start_ts !== undefined) event.availability_start_ts = payload.availability_start_ts;
    if (payload.availability_end_ts !== undefined) event.availability_end_ts = payload.availability_end_ts;
    return event;
  });
}
