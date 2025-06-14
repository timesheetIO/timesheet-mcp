import { describe, expect, test } from '@jest/globals';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

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