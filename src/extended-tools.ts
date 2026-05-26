/**
 * Extended MCP tool definitions and dispatcher for SDK 1.1.0 endpoints.
 *
 * Tools defined here cover absences, absence types, contracts, organizations
 * (and their members), team/project member management, todos, rates, tags,
 * and full CRUD for notes/expenses/pauses.
 *
 * The main server (src/index.ts) concatenates EXTENDED_TOOL_DEFINITIONS into
 * its tools array and calls dispatchExtendedTool() before throwing
 * MethodNotFound in its tool-call switch.
 */
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { TimesheetClient } from '@timesheet/sdk';

type ToolHandler = (client: TimesheetClient, args: any) => Promise<unknown>;

interface ToolEntry {
  definition: Record<string, unknown>;
  handler: ToolHandler;
}

const STR = { type: 'string' as const };
const NUM = { type: 'number' as const };
const BOOL = { type: 'boolean' as const };
const ARR_STR = { type: 'array' as const, items: { type: 'string' as const } };

function describe(text: string) {
  return { ...STR, description: text };
}

function textOk(text: string, structured?: Record<string, unknown>) {
  return {
    content: [{ type: 'text', text }],
    structuredContent: structured ?? { success: true },
  };
}

/**
 * Returns a JSON-stringified payload as MCP text content, with optional
 * structured payload. Used for read-only tools.
 */
function jsonOk(data: unknown, summary?: string) {
  return {
    content: [
      {
        type: 'text',
        text: summary ? `${summary}\n${JSON.stringify(data, null, 2)}` : JSON.stringify(data, null, 2),
      },
    ],
    structuredContent: data as Record<string, unknown>,
  };
}

const READ_ANNOT = { readOnlyHint: true, destructiveHint: false, openWorldHint: true };
const WRITE_ANNOT = { readOnlyHint: false, destructiveHint: false, openWorldHint: true };
const DESTRUCT_ANNOT = { readOnlyHint: false, destructiveHint: true, openWorldHint: true };

/**
 * Convert "snake_case_name" → "Snake Case Name", reordering verb-suffixes to
 * front (e.g. absence_list → "List Absences") and pluralizing list nouns.
 */
function humanTitle(name: string): string {
  if (name.endsWith('_file_url')) {
    const noun = name.slice(0, -'_file_url'.length).split('_').map(cap).join(' ');
    return `Get ${noun} File URL`;
  }
  const VERBS = new Set([
    'list', 'get', 'create', 'update', 'delete',
    'add', 'remove', 'approve', 'reject', 'cancel',
    'activate', 'suspend', 'reactivate', 'terminate',
    'close', 'reopen', 'refund',
  ]);
  const parts = name.split('_');
  const last = parts[parts.length - 1];
  if (parts.length >= 2 && VERBS.has(last)) {
    parts.pop();
    let noun = parts.map(cap).join(' ');
    if (last === 'list') noun = pluralize(noun);
    return `${cap(last)} ${noun}`;
  }
  return parts.map(cap).join(' ');
}
function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function pluralize(noun: string): string {
  if (!noun) return noun;
  if (/(s|x|z|ch|sh)$/i.test(noun)) return `${noun}es`;
  if (/[^aeiou]y$/i.test(noun)) return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}
/** Standard structured-content shape for write operations. */
const WRITE_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const, description: 'Resource ID' },
    success: { type: 'boolean' as const },
    deletedId: { type: 'string' as const },
  },
  additionalProperties: true,
};

/** Standard structured-content shape for list operations. */
const LIST_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    items: { type: 'array' as const, items: { type: 'object' as const, additionalProperties: true } },
    totalCount: { type: 'number' as const, description: 'Total items across all pages' },
  },
  additionalProperties: true,
};

interface AddOptions {
  /** Mark as idempotent (2025-11-25 annotation; ignored when readOnlyHint=true). */
  idempotent?: boolean;
  /** Override the default output schema. Pass null to omit. */
  outputSchema?: Record<string, unknown> | null;
}

/** Strip undefined keys so the SDK doesn't serialize them. */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

const tools: ToolEntry[] = [];

/**
 * Tool-name suffixes that map to idempotent operations under MCP 2025-11-25's
 * `idempotentHint` annotation. Deletes are idempotent (same end state),
 * state transitions are idempotent (re-approving an approved absence is a
 * no-op), and full-replacement updates are idempotent. Creates/adds are not.
 */
const IDEMPOTENT_SUFFIXES = new Set([
  'delete', 'remove',
  'update',
  'approve', 'reject', 'cancel',
  'activate', 'suspend', 'reactivate', 'terminate',
  'close', 'reopen',
  'refund',
]);

function add(
  name: string,
  description: string,
  inputProperties: Record<string, unknown>,
  required: string[],
  annotations: Record<string, boolean>,
  handler: ToolHandler,
  opts: AddOptions = {}
) {
  const title = humanTitle(name);
  const readOnly = annotations.readOnlyHint === true;
  const suffix = name.split('_').pop()!;
  const idempotent = opts.idempotent ?? IDEMPOTENT_SUFFIXES.has(suffix);
  const finalAnnotations: Record<string, unknown> = {
    ...annotations,
    title,
    ...(idempotent && !readOnly ? { idempotentHint: true } : {}),
  };

  // Default output schema: list-shape for `_list`, write-shape otherwise.
  // Read-of-single (get) tools omit outputSchema (response shape is the entity).
  let outputSchema: Record<string, unknown> | undefined;
  if (opts.outputSchema === null) {
    outputSchema = undefined;
  } else if (opts.outputSchema) {
    outputSchema = opts.outputSchema;
  } else if (name.endsWith('_list')) {
    outputSchema = LIST_OUTPUT_SCHEMA;
  } else if (!readOnly) {
    outputSchema = WRITE_OUTPUT_SCHEMA;
  }

  tools.push({
    definition: {
      name,
      title,
      description,
      inputSchema: {
        type: 'object',
        properties: inputProperties,
        ...(required.length ? { required } : {}),
      },
      ...(outputSchema ? { outputSchema } : {}),
      annotations: finalAnnotations,
    },
    handler,
  });
}

// ============================================================================
// Absences (org-scoped)
// ============================================================================
add(
  'absence_list',
  'List absences in an organization. Filter by contract, user, type, status, date range.',
  {
    organizationId: describe('Organization ID'),
    contractId: STR,
    userId: STR,
    absenceTypeId: STR,
    status: STR,
    startDate: describe('Start date (YYYY-MM-DD)'),
    endDate: describe('End date (YYYY-MM-DD)'),
    year: NUM,
    excludeRejectedCancelled: BOOL,
    teamId: STR,
    search: STR,
    limit: NUM,
    page: NUM,
  },
  ['organizationId'],
  READ_ANNOT,
  async (client, args) => {
    const { organizationId, ...params } = args;
    const page = await client.absences.list(organizationId, compact(params));
    return jsonOk({ items: page.items, totalCount: page.params?.count ?? page.items.length }, `Found ${page.items.length} absences.`);
  }
);

add(
  'absence_get',
  'Get a single absence by ID.',
  { organizationId: STR, id: STR },
  ['organizationId', 'id'],
  READ_ANNOT,
  async (client, args) => jsonOk(await client.absences.get(args.organizationId, args.id))
);

add(
  'absence_create',
  'Create a new absence (vacation, sick leave, etc.).',
  {
    organizationId: STR,
    contractId: STR,
    absenceTypeId: STR,
    startDateTime: describe('Start date/time (ISO 8601)'),
    endDateTime: describe('End date/time (ISO 8601)'),
    fullDay: BOOL,
    reason: STR,
    documentationUrl: STR,
    fileName: STR,
    fileUri: STR,
  },
  ['organizationId', 'contractId', 'absenceTypeId', 'startDateTime', 'endDateTime'],
  WRITE_ANNOT,
  async (client, args) => {
    const { organizationId, ...data } = args;
    const absence = await client.absences.create(organizationId, data);
    return textOk(`Absence created (ID: ${absence.id}, status: ${absence.status ?? '-'})`, { id: absence.id, status: absence.status });
  }
);

add(
  'absence_update',
  'Update an absence.',
  {
    organizationId: STR,
    id: STR,
    startDateTime: STR,
    endDateTime: STR,
    fullDay: BOOL,
    reason: STR,
    documentationUrl: STR,
    fileName: STR,
    fileUri: STR,
  },
  ['organizationId', 'id'],
  WRITE_ANNOT,
  async (client, args) => {
    const { organizationId, id, ...data } = args;
    const absence = await client.absences.update(organizationId, id, compact(data));
    return textOk(`Absence ${absence.id} updated.`, { id: absence.id, status: absence.status });
  }
);

add(
  'absence_delete',
  'Delete an absence.',
  { organizationId: STR, id: STR },
  ['organizationId', 'id'],
  DESTRUCT_ANNOT,
  async (client, args) => {
    await client.absences.delete(args.organizationId, args.id);
    return textOk(`Absence ${args.id} deleted.`, { deletedId: args.id });
  }
);

add(
  'absence_approve',
  'Approve a pending absence.',
  { organizationId: STR, id: STR },
  ['organizationId', 'id'],
  WRITE_ANNOT,
  async (client, args) => {
    const a = await client.absences.approve(args.organizationId, args.id);
    return textOk(`Absence ${a.id} approved (status: ${a.status ?? '-'}).`, { id: a.id, status: a.status });
  }
);

add(
  'absence_reject',
  'Reject a pending absence with a reason.',
  { organizationId: STR, id: STR, reason: STR },
  ['organizationId', 'id', 'reason'],
  WRITE_ANNOT,
  async (client, args) => {
    const a = await client.absences.reject(args.organizationId, args.id, { reason: args.reason });
    return textOk(`Absence ${a.id} rejected.`, { id: a.id, status: a.status });
  }
);

add(
  'absence_cancel',
  'Cancel an absence with a reason.',
  { organizationId: STR, id: STR, reason: STR },
  ['organizationId', 'id', 'reason'],
  WRITE_ANNOT,
  async (client, args) => {
    const a = await client.absences.cancel(args.organizationId, args.id, { reason: args.reason });
    return textOk(`Absence ${a.id} cancelled.`, { id: a.id, status: a.status });
  }
);

// ============================================================================
// Absence Types
// ============================================================================
add(
  'absence_type_list',
  'List absence types for an organization (vacation, sick, etc.).',
  { organizationId: STR, limit: NUM, page: NUM, search: STR },
  ['organizationId'],
  READ_ANNOT,
  async (client, args) => {
    const { organizationId, ...params } = args;
    const page = await client.absenceTypes.list(organizationId, compact(params));
    return jsonOk({ items: page.items, totalCount: page.params?.count ?? page.items.length }, `Found ${page.items.length} absence types.`);
  }
);

add(
  'absence_type_get',
  'Get a single absence type.',
  { organizationId: STR, id: STR },
  ['organizationId', 'id'],
  READ_ANNOT,
  async (client, args) => jsonOk(await client.absenceTypes.get(args.organizationId, args.id))
);

add(
  'absence_type_create',
  'Create a new absence type.',
  {
    organizationId: STR,
    code: STR,
    name: STR,
    description: STR,
    color: NUM,
    paid: BOOL,
    requiresApproval: BOOL,
    requiresDocumentation: BOOL,
    maxConsecutiveDays: NUM,
    minNoticeDays: NUM,
    countryCode: STR,
  },
  ['organizationId', 'code', 'name'],
  WRITE_ANNOT,
  async (client, args) => {
    const { organizationId, ...data } = args;
    const t = await client.absenceTypes.create(organizationId, data);
    return textOk(`Absence type "${t.name}" created (ID: ${t.id}).`, { id: t.id, name: t.name });
  }
);

add(
  'absence_type_update',
  'Update an absence type.',
  {
    organizationId: STR,
    id: STR,
    code: STR,
    name: STR,
    description: STR,
    color: NUM,
    paid: BOOL,
    requiresApproval: BOOL,
    requiresDocumentation: BOOL,
    maxConsecutiveDays: NUM,
    minNoticeDays: NUM,
  },
  ['organizationId', 'id'],
  WRITE_ANNOT,
  async (client, args) => {
    const { organizationId, id, ...data } = args;
    const t = await client.absenceTypes.update(organizationId, id, compact(data));
    return textOk(`Absence type ${t.id} updated.`, { id: t.id, name: t.name });
  }
);

add(
  'absence_type_delete',
  'Delete an absence type.',
  { organizationId: STR, id: STR },
  ['organizationId', 'id'],
  DESTRUCT_ANNOT,
  async (client, args) => {
    await client.absenceTypes.delete(args.organizationId, args.id);
    return textOk(`Absence type ${args.id} deleted.`, { deletedId: args.id });
  }
);

// ============================================================================
// Contracts (org-scoped)
// ============================================================================
add(
  'contract_list',
  'List employment contracts in an organization.',
  {
    organizationId: STR,
    userId: STR,
    status: STR,
    search: STR,
    limit: NUM,
    page: NUM,
  },
  ['organizationId'],
  READ_ANNOT,
  async (client, args) => {
    const { organizationId, ...params } = args;
    const page = await client.contracts.list(organizationId, compact(params));
    return jsonOk({ items: page.items, totalCount: page.params?.count ?? page.items.length }, `Found ${page.items.length} contracts.`);
  }
);

add(
  'contract_get',
  'Get a single contract.',
  { organizationId: STR, id: STR },
  ['organizationId', 'id'],
  READ_ANNOT,
  async (client, args) => jsonOk(await client.contracts.get(args.organizationId, args.id))
);

add(
  'contract_create',
  'Create a new employment contract.',
  {
    organizationId: STR,
    name: STR,
    userId: STR,
    validFrom: STR,
    validTo: STR,
    workDays: describe('Work-days pattern (e.g. "MTWTF--")'),
    weeklyHours: NUM,
    dailyHours: NUM,
    salaryType: STR,
    salaryAmount: NUM,
    salaryCurrency: STR,
    vacationDaysAnnual: NUM,
    countryCode: STR,
    timezone: STR,
  },
  ['organizationId', 'name', 'userId'],
  WRITE_ANNOT,
  async (client, args) => {
    const { organizationId, ...data } = args;
    const c = await client.contracts.create(organizationId, data);
    return textOk(`Contract "${c.name}" created (ID: ${c.id}).`, { id: c.id, name: c.name, status: c.status });
  }
);

add(
  'contract_update',
  'Update a contract.',
  {
    organizationId: STR,
    id: STR,
    name: STR,
    validFrom: STR,
    validTo: STR,
    workDays: STR,
    weeklyHours: NUM,
    dailyHours: NUM,
    salaryType: STR,
    salaryAmount: NUM,
    salaryCurrency: STR,
    vacationDaysAnnual: NUM,
  },
  ['organizationId', 'id'],
  WRITE_ANNOT,
  async (client, args) => {
    const { organizationId, id, ...data } = args;
    const c = await client.contracts.update(organizationId, id, compact(data));
    return textOk(`Contract ${c.id} updated.`, { id: c.id, name: c.name });
  }
);

add(
  'contract_delete',
  'Delete a contract.',
  { organizationId: STR, id: STR },
  ['organizationId', 'id'],
  DESTRUCT_ANNOT,
  async (client, args) => {
    await client.contracts.delete(args.organizationId, args.id);
    return textOk(`Contract ${args.id} deleted.`, { deletedId: args.id });
  }
);

for (const action of ['activate', 'suspend', 'reactivate', 'terminate'] as const) {
  add(
    `contract_${action}`,
    `${action.charAt(0).toUpperCase()}${action.slice(1)} a contract.`,
    { organizationId: STR, id: STR },
    ['organizationId', 'id'],
    WRITE_ANNOT,
    async (client, args) => {
      const c = await client.contracts[action](args.organizationId, args.id);
      return textOk(`Contract ${c.id} ${action}d (status: ${c.status ?? '-'}).`, { id: c.id, status: c.status });
    }
  );
}

// ============================================================================
// Organizations + Members
// ============================================================================
add(
  'organization_list',
  'List organizations the current user belongs to.',
  { search: STR, limit: NUM, page: NUM },
  [],
  READ_ANNOT,
  async (client, args) => {
    const page = await client.organizations.list(compact(args));
    return jsonOk({ items: page.items, totalCount: page.params?.count ?? page.items.length }, `Found ${page.items.length} organizations.`);
  }
);

add(
  'organization_get',
  'Get a single organization by ID.',
  { id: STR },
  ['id'],
  READ_ANNOT,
  async (client, args) => jsonOk(await client.organizations.get(args.id))
);

add(
  'organization_create',
  'Create a new organization.',
  { name: STR, description: STR, color: NUM, aiChatEnabled: BOOL },
  ['name'],
  WRITE_ANNOT,
  async (client, args) => {
    const org = await client.organizations.create(args);
    return textOk(`Organization "${org.name}" created (ID: ${org.id}).`, { id: org.id, name: org.name });
  }
);

add(
  'organization_update',
  'Update an organization.',
  { id: STR, name: STR, description: STR, color: NUM, aiChatEnabled: BOOL },
  ['id'],
  WRITE_ANNOT,
  async (client, args) => {
    const { id, ...data } = args;
    const org = await client.organizations.update(id, compact(data));
    return textOk(`Organization ${org.id} updated.`, { id: org.id, name: org.name });
  }
);

add(
  'organization_delete',
  'Delete an organization (irreversible).',
  { id: STR },
  ['id'],
  DESTRUCT_ANNOT,
  async (client, args) => {
    await client.organizations.delete(args.id);
    return textOk(`Organization ${args.id} deleted.`, { deletedId: args.id });
  }
);

add(
  'organization_member_list',
  'List members of an organization.',
  { organizationId: STR, deleted: BOOL, search: STR, limit: NUM, page: NUM },
  ['organizationId'],
  READ_ANNOT,
  async (client, args) => {
    const { organizationId, ...params } = args;
    const page = await client.organizations.listMembers(organizationId, compact(params));
    return jsonOk({ items: page.items, totalCount: page.params?.count ?? page.items.length }, `Found ${page.items.length} members.`);
  }
);

add(
  'organization_member_get',
  'Get a single organization member.',
  { organizationId: STR, memberId: STR },
  ['organizationId', 'memberId'],
  READ_ANNOT,
  async (client, args) => jsonOk(await client.organizations.getMember(args.organizationId, args.memberId))
);

add(
  'organization_member_add',
  'Add (invite) a member to an organization.',
  {
    organizationId: STR,
    email: STR,
    firstname: STR,
    lastname: STR,
    admin: BOOL,
    invoicing: BOOL,
    billing: BOOL,
  },
  ['organizationId', 'email'],
  WRITE_ANNOT,
  async (client, args) => {
    const { organizationId, ...data } = args;
    const m = await client.organizations.addMember(organizationId, data);
    return textOk(`Member ${m.email} added.`, { id: m.id, email: m.email });
  }
);

add(
  'organization_member_update',
  "Update an organization member's permissions.",
  { organizationId: STR, memberId: STR, admin: BOOL, invoicing: BOOL, billing: BOOL },
  ['organizationId', 'memberId'],
  WRITE_ANNOT,
  async (client, args) => {
    const { organizationId, memberId, ...data } = args;
    const m = await client.organizations.updateMember(organizationId, memberId, compact(data));
    return textOk(`Member ${m.id} updated.`, { id: m.id, email: m.email });
  }
);

add(
  'organization_member_remove',
  'Remove a member from an organization. Use invited:true to permanently delete an invited (not-yet-activated) member.',
  { organizationId: STR, memberId: STR, invited: BOOL },
  ['organizationId', 'memberId'],
  DESTRUCT_ANNOT,
  async (client, args) => {
    if (args.invited) {
      await client.organizations.removeInvitedMember(args.organizationId, args.memberId);
    } else {
      await client.organizations.removeMember(args.organizationId, args.memberId);
    }
    return textOk(`Member ${args.memberId} removed.`, { deletedId: args.memberId });
  }
);

// ============================================================================
// Team Members
// ============================================================================
add(
  'team_member_list',
  'List members of a team.',
  {
    teamId: STR,
    status: STR,
    withoutMe: BOOL,
    deleted: BOOL,
    search: STR,
    limit: NUM,
    page: NUM,
  },
  ['teamId'],
  READ_ANNOT,
  async (client, args) => {
    const { teamId, ...rest } = args;
    const page = await client.teams.listMembers(teamId, { teamId, ...compact(rest) });
    return jsonOk({ items: page.items, totalCount: page.params?.count ?? page.items.length }, `Found ${page.items.length} team members.`);
  }
);

add(
  'team_member_get',
  'Get a single team member.',
  { teamId: STR, memberId: STR },
  ['teamId', 'memberId'],
  READ_ANNOT,
  async (client, args) => jsonOk(await client.teams.getMember(args.teamId, args.memberId))
);

add(
  'team_member_add',
  'Add (invite) a member to a team.',
  {
    teamId: STR,
    email: STR,
    firstname: STR,
    lastname: STR,
    employeeId: STR,
    role: describe('Permission role (owner, manager, member)'),
  },
  ['teamId', 'email'],
  WRITE_ANNOT,
  async (client, args) => {
    const { teamId, role, ...data } = args;
    const m = await client.teams.addMember(teamId, {
      ...data,
      permission: role ? { role } : undefined,
    });
    return textOk(`Team member ${m.email} added.`, { id: m.id, email: m.email });
  }
);

add(
  'team_member_update',
  "Update a team member's profile or permissions.",
  {
    teamId: STR,
    memberId: STR,
    firstname: STR,
    lastname: STR,
    employeeId: STR,
    role: STR,
    activate: BOOL,
    autoJoinProjects: BOOL,
  },
  ['teamId', 'memberId'],
  WRITE_ANNOT,
  async (client, args) => {
    const { teamId, memberId, role, ...data } = args;
    const m = await client.teams.updateMember(teamId, memberId, {
      ...compact(data),
      permission: role ? { role } : undefined,
    });
    return textOk(`Team member ${m.id} updated.`, { id: m.id, email: m.email });
  }
);

add(
  'team_member_remove',
  'Remove a member from a team. Use invited:true to permanently delete an invited (not-yet-activated) member.',
  { teamId: STR, memberId: STR, invited: BOOL },
  ['teamId', 'memberId'],
  DESTRUCT_ANNOT,
  async (client, args) => {
    if (args.invited) {
      await client.teams.removeInvitedMember(args.teamId, args.memberId);
    } else {
      await client.teams.removeMember(args.teamId, args.memberId);
    }
    return textOk(`Team member ${args.memberId} removed.`, { deletedId: args.memberId });
  }
);

add(
  'team_member_status',
  'List members with their current activity status (running/idle).',
  {
    teamId: STR,
    projectId: STR,
    organizationId: STR,
    status: describe('all | active | inactive | running | idle'),
    limit: NUM,
    page: NUM,
  },
  [],
  READ_ANNOT,
  async (client, args) => {
    const page = await client.teams.getMemberStatus(compact(args));
    return jsonOk({ items: page.items, totalCount: page.params?.count ?? page.items.length }, `Found ${page.items.length} members.`);
  }
);

// ============================================================================
// Project Members
// ============================================================================
add(
  'project_member_list',
  'List members of a project.',
  {
    projectId: STR,
    status: STR,
    withoutMe: BOOL,
    withDeleted: BOOL,
    search: STR,
    limit: NUM,
    page: NUM,
  },
  ['projectId'],
  READ_ANNOT,
  async (client, args) => {
    const { projectId, ...rest } = args;
    const page = await client.projects.listMembers(projectId, { projectId, ...compact(rest) });
    return jsonOk({ items: page.items, totalCount: page.params?.count ?? page.items.length }, `Found ${page.items.length} project members.`);
  }
);

add(
  'project_member_get',
  'Get a single project member.',
  { projectId: STR, memberId: STR },
  ['projectId', 'memberId'],
  READ_ANNOT,
  async (client, args) => jsonOk(await client.projects.getMember(args.projectId, args.memberId))
);

add(
  'project_member_add',
  'Add a member to a project. Supply either email or userId.',
  {
    projectId: STR,
    email: STR,
    userId: STR,
    role: describe('Permission role (owner, manager, member)'),
  },
  ['projectId'],
  WRITE_ANNOT,
  async (client, args) => {
    const { projectId, role, ...data } = args;
    if (!data.email && !data.userId) {
      throw new McpError(ErrorCode.InvalidParams, 'Either email or userId must be provided.');
    }
    const m = await client.projects.addMember(projectId, {
      ...data,
      permission: role ? { role } : undefined,
    });
    return textOk(`Project member ${m.email} added.`, { id: m.id, email: m.email });
  }
);

add(
  'project_member_update',
  "Update a project member's role.",
  { projectId: STR, memberId: STR, role: STR },
  ['projectId', 'memberId', 'role'],
  WRITE_ANNOT,
  async (client, args) => {
    const m = await client.projects.updateMember(args.projectId, args.memberId, {
      permission: { role: args.role },
    });
    return textOk(`Project member ${m.id} updated.`, { id: m.id, email: m.email });
  }
);

add(
  'project_member_remove',
  'Remove a member from a project.',
  { projectId: STR, memberId: STR },
  ['projectId', 'memberId'],
  DESTRUCT_ANNOT,
  async (client, args) => {
    await client.projects.removeMember(args.projectId, args.memberId);
    return textOk(`Project member ${args.memberId} removed.`, { deletedId: args.memberId });
  }
);

// ============================================================================
// Todos
// ============================================================================
const TODO_STATUS_OPEN = 0;
const TODO_STATUS_CLOSED = 1;

add(
  'todo_list',
  'List todos. Filter by project, status (open/closed), assigned user.',
  {
    projectId: STR,
    status: describe("'open' or 'closed'"),
    assignedUsers: STR,
    search: STR,
    limit: NUM,
    page: NUM,
  },
  [],
  READ_ANNOT,
  async (client, args) => {
    const page = await client.todos.list(compact(args));
    return jsonOk({ items: page.items, totalCount: page.params?.count ?? page.items.length }, `Found ${page.items.length} todos.`);
  }
);

add(
  'todo_get',
  'Get a single todo.',
  { id: STR },
  ['id'],
  READ_ANNOT,
  async (client, args) => jsonOk(await client.todos.get(args.id))
);

add(
  'todo_create',
  'Create a new todo.',
  {
    name: STR,
    projectId: STR,
    description: STR,
    dueDate: describe('Due date (YYYY-MM-DD)'),
    assignedUsers: STR,
    estimatedHours: NUM,
    estimatedMinutes: NUM,
  },
  ['name', 'projectId'],
  WRITE_ANNOT,
  async (client, args) => {
    const t = await client.todos.create(args);
    return textOk(`Todo "${t.name}" created (ID: ${t.id}).`, { id: t.id, name: t.name });
  }
);

add(
  'todo_update',
  "Update a todo. Pass status as 'open', 'closed', or a raw number.",
  {
    id: STR,
    name: STR,
    description: STR,
    status: STR,
    dueDate: STR,
    assignedUsers: STR,
    estimatedHours: NUM,
    estimatedMinutes: NUM,
  },
  ['id'],
  WRITE_ANNOT,
  async (client, args) => {
    const { id, status, ...rest } = args;
    const data: Record<string, unknown> = { ...compact(rest) };
    if (status === 'open') data.status = TODO_STATUS_OPEN;
    else if (status === 'closed') data.status = TODO_STATUS_CLOSED;
    else if (status !== undefined) {
      const n = typeof status === 'number' ? status : parseInt(status, 10);
      if (!isNaN(n)) data.status = n;
    }
    const t = await client.todos.update(id, data);
    return textOk(`Todo ${t.id} updated.`, { id: t.id, name: t.name, status: t.status });
  }
);

add(
  'todo_close',
  'Close (complete) a todo.',
  { id: STR },
  ['id'],
  WRITE_ANNOT,
  async (client, args) => {
    const t = await client.todos.update(args.id, { status: TODO_STATUS_CLOSED });
    return textOk(`Todo "${t.name}" closed.`, { id: t.id, status: t.status });
  }
);

add(
  'todo_reopen',
  'Reopen a closed todo.',
  { id: STR },
  ['id'],
  WRITE_ANNOT,
  async (client, args) => {
    const t = await client.todos.update(args.id, { status: TODO_STATUS_OPEN });
    return textOk(`Todo "${t.name}" reopened.`, { id: t.id, status: t.status });
  }
);

add(
  'todo_delete',
  'Delete a todo.',
  { id: STR },
  ['id'],
  DESTRUCT_ANNOT,
  async (client, args) => {
    await client.todos.delete(args.id);
    return textOk(`Todo ${args.id} deleted.`, { deletedId: args.id });
  }
);

// ============================================================================
// Rates
// ============================================================================
add(
  'rate_list',
  'List rates.',
  {
    teamId: STR,
    projectId: STR,
    status: describe('all | active | inactive'),
    search: STR,
    limit: NUM,
    page: NUM,
  },
  [],
  READ_ANNOT,
  async (client, args) => {
    const page = await client.rates.list(compact(args));
    return jsonOk({ items: page.items, totalCount: page.params?.count ?? page.items.length }, `Found ${page.items.length} rates.`);
  }
);

add(
  'rate_get',
  'Get a single rate.',
  { id: STR },
  ['id'],
  READ_ANNOT,
  async (client, args) => jsonOk(await client.rates.get(args.id))
);

add(
  'rate_create',
  'Create a new rate.',
  {
    title: STR,
    factor: describe('Rate factor (decimal string)'),
    extra: STR,
    enabled: BOOL,
    archived: BOOL,
    teamId: STR,
  },
  ['title', 'factor'],
  WRITE_ANNOT,
  async (client, args) => {
    const r = await client.rates.create(args);
    return textOk(`Rate "${r.title}" created (ID: ${r.id}).`, { id: r.id, title: r.title });
  }
);

add(
  'rate_update',
  'Update a rate.',
  { id: STR, title: STR, factor: STR, extra: STR, enabled: BOOL, archived: BOOL },
  ['id'],
  WRITE_ANNOT,
  async (client, args) => {
    const { id, ...data } = args;
    const r = await client.rates.update(id, compact(data));
    return textOk(`Rate ${r.id} updated.`, { id: r.id, title: r.title });
  }
);

add(
  'rate_delete',
  'Delete a rate.',
  { id: STR },
  ['id'],
  DESTRUCT_ANNOT,
  async (client, args) => {
    await client.rates.delete(args.id);
    return textOk(`Rate ${args.id} deleted.`, { deletedId: args.id });
  }
);

// ============================================================================
// Tags (full CRUD; previous MCP only had timer-context note/expense add)
// ============================================================================
add(
  'tag_list',
  'List tags. Filter by team/project and active/inactive status. (Tags do not support free-text search at the API level.)',
  {
    teamId: STR,
    projectId: STR,
    status: { type: 'string', enum: ['all', 'active', 'inactive'], description: 'Active/inactive filter' },
    sort: { type: 'string', enum: ['alpha', 'status', 'created'], description: 'Sort field' },
    order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order' },
    limit: NUM,
    page: NUM,
  },
  [],
  READ_ANNOT,
  async (client, args) => {
    const page = await client.tags.list(compact(args));
    return jsonOk({ items: page.items, totalCount: page.params?.count ?? page.items.length }, `Found ${page.items.length} tags.`);
  }
);

add(
  'tag_get',
  'Get a single tag.',
  { id: STR },
  ['id'],
  READ_ANNOT,
  async (client, args) => jsonOk(await client.tags.get(args.id))
);

add(
  'tag_create',
  'Create a new tag.',
  { name: STR, color: NUM, teamId: STR, archived: BOOL },
  ['name'],
  WRITE_ANNOT,
  async (client, args) => {
    const t = await client.tags.create(args);
    return textOk(`Tag "${t.name}" created (ID: ${t.id}).`, { id: t.id, name: t.name });
  }
);

add(
  'tag_update',
  'Update a tag.',
  { id: STR, name: STR, color: NUM, archived: BOOL },
  ['id'],
  WRITE_ANNOT,
  async (client, args) => {
    const { id, ...data } = args;
    const t = await client.tags.update(id, compact(data));
    return textOk(`Tag ${t.id} updated.`, { id: t.id, name: t.name });
  }
);

add(
  'tag_delete',
  'Delete a tag.',
  { id: STR },
  ['id'],
  DESTRUCT_ANNOT,
  async (client, args) => {
    await client.tags.delete(args.id);
    return textOk(`Tag ${args.id} deleted.`, { deletedId: args.id });
  }
);

// ============================================================================
// Notes — full CRUD (task_add_note covers the timer case already)
// ============================================================================
add(
  'note_list',
  'List notes (across tasks). Filter by task, document, organization, or date range.',
  {
    taskId: STR,
    documentId: STR,
    organizationId: STR,
    startDate: STR,
    endDate: STR,
    search: STR,
    limit: NUM,
    page: NUM,
  },
  [],
  READ_ANNOT,
  async (client, args) => {
    const page = await client.notes.list(compact(args));
    return jsonOk({ items: page.items, totalCount: page.params?.count ?? page.items.length }, `Found ${page.items.length} notes.`);
  }
);

add(
  'note_get',
  'Get a single note.',
  { id: STR },
  ['id'],
  READ_ANNOT,
  async (client, args) => jsonOk(await client.notes.get(args.id))
);

add(
  'note_create',
  'Create a note attached to a task (without using the active timer).',
  {
    taskId: STR,
    text: STR,
    dateTime: describe('ISO date/time'),
    uri: STR,
    driveId: STR,
  },
  ['taskId', 'text', 'dateTime'],
  WRITE_ANNOT,
  async (client, args) => {
    const n = await client.notes.create(args);
    return textOk(`Note created (ID: ${n.id}).`, { id: n.id });
  }
);

add(
  'note_update',
  'Update a note.',
  { id: STR, text: STR, dateTime: STR, uri: STR, driveId: STR },
  ['id'],
  WRITE_ANNOT,
  async (client, args) => {
    const { id, ...data } = args;
    const n = await client.notes.update(id, compact(data));
    return textOk(`Note ${n.id} updated.`, { id: n.id });
  }
);

add(
  'note_delete',
  'Delete a note.',
  { id: STR },
  ['id'],
  DESTRUCT_ANNOT,
  async (client, args) => {
    await client.notes.delete(args.id);
    return textOk(`Note ${args.id} deleted.`, { deletedId: args.id });
  }
);

// ============================================================================
// Expenses — full CRUD + refund toggle
// ============================================================================
add(
  'expense_list',
  'List expenses.',
  {
    taskId: STR,
    documentId: STR,
    organizationId: STR,
    projectIds: ARR_STR,
    startDate: STR,
    endDate: STR,
    filter: STR,
    search: STR,
    limit: NUM,
    page: NUM,
  },
  [],
  READ_ANNOT,
  async (client, args) => {
    const page = await client.expenses.list(compact(args));
    return jsonOk({ items: page.items, totalCount: page.params?.count ?? page.items.length }, `Found ${page.items.length} expenses.`);
  }
);

add(
  'expense_get',
  'Get a single expense.',
  { id: STR },
  ['id'],
  READ_ANNOT,
  async (client, args) => jsonOk(await client.expenses.get(args.id))
);

add(
  'expense_create',
  'Create an expense attached to a task (without using the active timer).',
  {
    taskId: STR,
    dateTime: describe('ISO date/time'),
    amount: describe('Amount (decimal string)'),
    description: STR,
    refunded: BOOL,
    fileName: STR,
    fileUri: STR,
  },
  ['taskId', 'dateTime'],
  WRITE_ANNOT,
  async (client, args) => {
    const e = await client.expenses.create(args);
    return textOk(`Expense created (ID: ${e.id}).`, { id: e.id });
  }
);

add(
  'expense_update',
  'Update an expense.',
  {
    id: STR,
    dateTime: STR,
    amount: STR,
    description: STR,
    refunded: BOOL,
    fileName: STR,
    fileUri: STR,
  },
  ['id'],
  WRITE_ANNOT,
  async (client, args) => {
    const { id, ...data } = args;
    const e = await client.expenses.update(id, compact(data));
    return textOk(`Expense ${e.id} updated.`, { id: e.id });
  }
);

add(
  'expense_delete',
  'Delete an expense.',
  { id: STR },
  ['id'],
  DESTRUCT_ANNOT,
  async (client, args) => {
    await client.expenses.delete(args.id);
    return textOk(`Expense ${args.id} deleted.`, { deletedId: args.id });
  }
);

add(
  'expense_refund',
  'Mark an expense as refunded (or not).',
  { id: STR, refunded: BOOL },
  ['id', 'refunded'],
  WRITE_ANNOT,
  async (client, args) => {
    const e = await client.expenses.updateStatus({ id: args.id, refunded: args.refunded });
    return textOk(`Expense ${e.id} refunded=${args.refunded}.`, { id: e.id, refunded: args.refunded });
  }
);

add(
  'expense_file_url',
  'Get a signed download URL for the expense attachment.',
  { id: STR },
  ['id'],
  READ_ANNOT,
  async (client, args) => {
    const result = await client.expenses.getFileUrl(args.id);
    return jsonOk(result);
  }
);

add(
  'note_file_url',
  'Get a signed download URL for the note attachment.',
  { id: STR },
  ['id'],
  READ_ANNOT,
  async (client, args) => {
    const result = await client.notes.getFileUrl(args.id);
    return jsonOk(result);
  }
);

// ============================================================================
// Pauses — full CRUD (task_add_pause covers the timer case)
// ============================================================================
add(
  'pause_list',
  'List pauses/breaks.',
  { taskId: STR, search: STR, limit: NUM, page: NUM },
  [],
  READ_ANNOT,
  async (client, args) => {
    const page = await client.pauses.list(compact(args));
    return jsonOk({ items: page.items, totalCount: page.params?.count ?? page.items.length }, `Found ${page.items.length} pauses.`);
  }
);

add(
  'pause_get',
  'Get a single pause.',
  { id: STR },
  ['id'],
  READ_ANNOT,
  async (client, args) => jsonOk(await client.pauses.get(args.id))
);

add(
  'pause_create',
  'Create a pause attached to a task.',
  {
    taskId: STR,
    startDateTime: STR,
    endDateTime: STR,
    description: STR,
  },
  ['taskId', 'startDateTime', 'endDateTime'],
  WRITE_ANNOT,
  async (client, args) => {
    const p = await client.pauses.create(args);
    return textOk(`Pause created (ID: ${p.id}).`, { id: p.id });
  }
);

add(
  'pause_update',
  'Update a pause.',
  { id: STR, startDateTime: STR, endDateTime: STR, description: STR },
  ['id'],
  WRITE_ANNOT,
  async (client, args) => {
    const { id, ...data } = args;
    const p = await client.pauses.update(id, compact(data));
    return textOk(`Pause ${p.id} updated.`, { id: p.id });
  }
);

add(
  'pause_delete',
  'Delete a pause.',
  { id: STR },
  ['id'],
  DESTRUCT_ANNOT,
  async (client, args) => {
    await client.pauses.delete(args.id);
    return textOk(`Pause ${args.id} deleted.`, { deletedId: args.id });
  }
);

// ============================================================================
// Profile + Settings writes (mirror existing reads via auth_configure flow)
// ============================================================================
add(
  'profile_get',
  "Get the current user's profile.",
  {},
  [],
  READ_ANNOT,
  async (client) => jsonOk(await client.profile.getProfile())
);

add(
  'profile_update',
  "Update the current user's profile.",
  { email: STR, firstname: STR, lastname: STR, imageUrl: STR, newsletter: BOOL },
  [],
  WRITE_ANNOT,
  async (client, args) => {
    const p = await client.profile.updateProfile(compact(args));
    return textOk('Profile updated.', { email: p.email });
  }
);

add(
  'settings_get',
  "Get the current user's settings.",
  {},
  [],
  READ_ANNOT,
  async (client) => jsonOk(await client.settings.get())
);

add(
  'settings_update',
  "Update the current user's settings.",
  {
    theme: { type: 'string', enum: ['light', 'dark', 'system'], description: 'UI theme' },
    language: STR,
    timezone: STR,
    currency: STR,
    dateFormat: STR,
    timeFormat: STR,
    durationFormat: STR,
    firstDay: { type: 'number', description: 'First day of the week (0=Sunday, 1=Monday, ...)' },
    defaultTaskDuration: NUM,
    defaultBreakDuration: NUM,
  },
  [],
  WRITE_ANNOT,
  async (client, args) => {
    const s = await client.settings.update(compact(args));
    return textOk('Settings updated.', { theme: s.theme, language: s.language });
  }
);

export const EXTENDED_TOOL_DEFINITIONS = tools.map((t) => t.definition);

const handlerMap: Record<string, ToolHandler> = Object.fromEntries(
  tools.map((t) => [(t.definition as { name: string }).name, t.handler])
);

/**
 * Dispatch an extended tool call.
 *
 * @returns The MCP tool response, or `null` if `name` is not an extended tool
 *          (so the caller can fall through to MethodNotFound).
 */
export async function dispatchExtendedTool(
  client: TimesheetClient,
  name: string,
  args: unknown
): Promise<unknown | null> {
  const handler = handlerMap[name];
  if (!handler) return null;
  try {
    return await handler(client, (args ?? {}) as Record<string, unknown>);
  } catch (error) {
    if (error instanceof McpError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error executing ${name}: ${message}` }],
      isError: true,
    };
  }
}
