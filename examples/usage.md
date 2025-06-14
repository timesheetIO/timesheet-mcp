# Timesheet MCP Usage Examples

## Timer Control Examples

### Starting a Timer
```typescript
// Basic timer start
await mcp.call('timer_start', {
  projectId: 'project-123'
});

// Start timer with past time (10 minutes ago)
const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
await mcp.call('timer_start', {
  projectId: 'project-123',
  startDateTime: tenMinutesAgo
});
```

### Timer Status Check
```typescript
// Check if timer is running
const status = await mcp.call('timer_status', {});
// Returns: "Timer status: running\nProject: Website Redesign\nCurrent duration: 1h 23m"
```

### Pausing and Resuming
```typescript
// Take a break
await mcp.call('timer_pause', {});

// Back from break
await mcp.call('timer_resume', {});
```

### Stopping Timer
```typescript
// Stop timer (marks task as complete)
await mcp.call('timer_stop', {});
// Returns: "Timer stopped. Total time: 2h 45m"
```

## Task Enhancement Examples

### Adding Notes
```typescript
// Add a note to current running task
await mcp.call('task_add_note', {
  text: 'Discussed API changes with client, need to update endpoints'
});
```

### Adding Expenses
```typescript
// Add expense to current task
await mcp.call('task_add_expense', {
  description: 'Taxi to client meeting',
  amount: 45.50
});
```

### Updating Running Task
```typescript
// Update description and mark as billable
await mcp.call('timer_update', {
  description: 'API Integration - OAuth implementation',
  billable: true,
  feeling: 8,
  tags: ['backend', 'oauth', 'security']
});
```

## Project Management Examples

### List Projects
```typescript
// Get all active projects
const projects = await mcp.call('project_list', {
  status: 'active'
});
```

### Create Project
```typescript
// Create new project
await mcp.call('project_create', {
  title: 'Mobile App v2',
  description: 'Complete redesign of mobile application',
  taskDefaultBillable: true,
  teamId: 'team-456'
});
```

## Task Management Examples

### List Today's Tasks
```typescript
const today = new Date().toISOString().split('T')[0];
await mcp.call('task_list', {
  startDate: today,
  endDate: today
});
```

### Create Manual Task Entry
```typescript
// Log 2 hours for yesterday
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
const start = new Date(yesterday.setHours(9, 0, 0, 0)).toISOString();
const end = new Date(yesterday.setHours(11, 0, 0, 0)).toISOString();

await mcp.call('task_create', {
  projectId: 'project-123',
  startDateTime: start,
  endDateTime: end,
  description: 'Code review and refactoring',
  billable: true
});
```

## Natural Language Usage in Claude

When using Claude with the Timesheet MCP, you can use natural language:

- "Start timer for the mobile app project"
- "I'm taking a lunch break" 
- "Add a note that I fixed the login bug"
- "Stop the timer, I'm done for today"
- "What have I worked on this week?"
- "Create a new project called Website Redesign"
- "Mark my current task as non-billable"