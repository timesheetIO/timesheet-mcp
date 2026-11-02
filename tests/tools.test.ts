import { describe, expect, test } from '@jest/globals';
import { TOOL_DEFINITIONS } from '../src/tool-definitions.js';

describe('Tool Definitions', () => {
  const toolDefinitions = [
    'timer_start',
    'timer_stop', 
    'timer_pause',
    'timer_resume',
    'timer_status',
    'timer_update',
    'task_add_note',
    'task_add_expense',
    'task_add_pause',
    'project_list',
    'project_create',
    'project_update',
    'project_delete',
    'task_list',
    'task_create',
    'task_update',
    'task_delete',
    'auth_configure',
  ];

  test('all expected tools are defined', () => {
    // This is a basic test to ensure we have the expected number of tools
    expect(toolDefinitions.length).toBe(18);
  });

  test('timer tools follow naming convention', () => {
    const timerTools = toolDefinitions.filter(tool => tool.startsWith('timer_'));
    expect(timerTools).toHaveLength(6);
    expect(timerTools).toEqual([
      'timer_start',
      'timer_stop',
      'timer_pause',
      'timer_resume',
      'timer_status',
      'timer_update',
    ]);
  });

  test('task enhancement tools follow naming convention', () => {
    const taskTools = toolDefinitions.filter(tool => tool.startsWith('task_add_'));
    expect(taskTools).toHaveLength(3);
    expect(taskTools).toEqual([
      'task_add_note',
      'task_add_expense',
      'task_add_pause',
    ]);
  });

  test('project management tools follow naming convention', () => {
    const projectTools = toolDefinitions.filter(tool => tool.startsWith('project_'));
    expect(projectTools).toHaveLength(4);
    expect(projectTools).toEqual([
      'project_list',
      'project_create',
      'project_update',
      'project_delete',
    ]);
  });

  test('task management tools follow naming convention', () => {
    const taskMgmtTools = toolDefinitions.filter(tool => 
      tool.startsWith('task_') && !tool.startsWith('task_add_')
    );
    expect(taskMgmtTools).toHaveLength(4);
    expect(taskMgmtTools).toEqual([
      'task_list',
      'task_create',
      'task_update',
      'task_delete',
    ]);
  });

  test('destructive tools should have appropriate annotations', () => {
    const destructiveTools = ['project_delete', 'task_delete'];
    expect(destructiveTools).toHaveLength(2);
  });
});

describe('Tool annotations', () => {
  // TOOL_DEFINITIONS is the served list, extended tools included.
  const all = TOOL_DEFINITIONS as unknown as Array<{
    name: string;
    annotations?: { destructiveHint?: boolean };
  }>;

  test('every update and delete tool is marked destructive, as updates overwrite values', () => {
    const changing = all.filter((t) => /_(update|delete)$/.test(t.name));
    expect(changing.length).toBeGreaterThan(30);
    expect(changing.filter((t) => t.annotations?.destructiveHint !== true).map((t) => t.name)).toEqual([]);
  });
});

describe('Export title', () => {
  // The heading of a PDF export; tests/e2e/output-schemas.test.mjs checks that it reaches the API
  test('the export and export template write tools take a title', () => {
    for (const name of ['export_generate', 'export_send', 'export_template_create', 'export_template_update']) {
      const tool = TOOL_DEFINITIONS.find((t) => t.name === name);
      const title = (tool?.inputSchema.properties as Record<string, { type?: string; description?: string }>)?.title;
      expect(title?.type).toBe('string');
      expect(title?.description).toMatch(/pdf/i);
    }
  });
});

describe('Export settings', () => {
  // The settings ExportParams and the export template requests share. export_send took only a few of
  // them and export_template_update five, so those tools made other exports than asked for.
  const SETTINGS = ['format', 'teamIds', 'projectIds', 'userIds', 'tagIds', 'type', 'filter', 'splitTask', 'summarize', 'filename', 'title', 'exportedFields'];
  const schema = (name: string) => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === name);
    return tool?.inputSchema as { properties: Record<string, { type?: string; enum?: string[]; description?: string; items?: { type?: string } }>; required?: string[] };
  };

  test('every export and export template write tool takes every setting', () => {
    for (const name of ['export_generate', 'export_send', 'export_template_create', 'export_template_update']) {
      expect({ name, missing: SETTINGS.filter((key) => !schema(name).properties[key]) }).toEqual({ name, missing: [] });
    }
    // and the template tools the template's own fields
    for (const name of ['export_template_create', 'export_template_update']) {
      expect(Object.keys(schema(name).properties)).toEqual(expect.arrayContaining(['name', 'report', 'email']));
    }
  });

  test('export_send takes what export_generate takes, and the recipient', () => {
    const generate = Object.keys(schema('export_generate').properties).sort();
    const send = Object.keys(schema('export_send').properties).filter((key) => key !== 'email').sort();
    expect(send).toEqual(generate);
    expect(schema('export_send').required).toEqual(['email', 'report', 'startDate', 'endDate']);
  });

  test('the settings take the values the Reports API knows', () => {
    const { properties } = schema('export_generate');
    expect(properties.format.enum).toEqual(['xlsx', 'xlsx1904', 'csv', 'pdf']);
    expect(properties.type.enum).toEqual(['all', 'task', 'mileage', 'call']);
    expect(properties.filter.enum).toEqual(['all', 'billable', 'notBillable', 'paid', 'unpaid', 'billed', 'outstanding']);
    expect(properties.splitTask.type).toBe('boolean');
    expect(properties.summarize.type).toBe('boolean');
    for (const key of ['teamIds', 'projectIds', 'userIds', 'tagIds', 'exportedFields']) {
      expect({ key, type: properties[key].type, items: properties[key].items?.type }).toEqual({ key, type: 'array', items: 'string' });
    }
    // Columns are field IDs from export_fields
    expect(properties.exportedFields.description).toMatch(/export_fields/);
  });

  test('export_template_update needs only the template, and a left-out setting keeps the stored one', () => {
    const { properties, required } = schema('export_template_update');
    expect(required).toEqual(['templateId']);
    const notKept = Object.entries(properties)
      .filter(([key]) => key !== 'templateId')
      .filter(([, property]) => !/Leave it out to keep/.test(property.description ?? ''))
      .map(([key]) => key);
    expect(notKept).toEqual([]);
  });
});
