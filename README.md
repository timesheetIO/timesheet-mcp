# Timesheet MCP Server

[![npm version](https://img.shields.io/npm/v/@timesheet/mcp.svg)](https://www.npmjs.com/package/@timesheet/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/@timesheet/mcp.svg)](https://nodejs.org)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io)

A Model Context Protocol (MCP) server that provides natural language access to the Timesheet API through standardized tools.

## Features

- **Timer Management**: Start, stop, pause, and resume timers with natural language
- **Task Enhancement**: Add notes, expenses, and pauses to running tasks
- **Project Management**: Create, update, list, and delete projects
- **Task Management**: Full CRUD operations for tasks
- **Natural Language Support**: Use simple phrases to control your timer

## Installation

### Quick Start with npx

The easiest way to use the Timesheet MCP server is with npx (no installation required):

```bash
npx @timesheet/mcp
```

### Global Installation

For frequent use, you can install globally:

```bash
npm install -g @timesheet/mcp
timesheet-mcp
```

### Local Installation

For project-specific installation:

```bash
npm install @timesheet/mcp
```

## Configuration

### Using Environment Variables

Create a `.env` file with your API token:

```env
TIMESHEET_API_TOKEN=your-api-token-here
```

### Using Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "timesheet": {
      "command": "npx",
      "args": ["@timesheet/mcp-server"],
      "env": {
        "TIMESHEET_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

For a globally installed version:

```json
{
  "mcpServers": {
    "timesheet": {
      "command": "timesheet-mcp",
      "env": {
        "TIMESHEET_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

## Sample Prompts

### Timer Control
- **Start timer**: 
  - "Start the timer for ProjectX"
  - "Start timer for ProjectX 10 minutes ago"
  - "Begin tracking time on the mobile app project"
  
- **Stop timer**:
  - "Stop the timer"
  - "Stop working"
  - "I'm done for the day"
  
- **Pause timer**:
  - "I have a break"
  - "Pause the timer"
  - "Taking lunch"
  
- **Resume timer**:
  - "Resume work"
  - "Back from break"
  - "Continue timer"
  
- **Check status**:
  - "What's my timer status?"
  - "Am I tracking time?"
  - "Show current timer"

### Task Enhancements
- **Add notes**:
  - "Add a note: Fixed the login bug"
  - "Note that I spoke with the client about requirements"
  
- **Add expenses**:
  - "Add expense: $45 for lunch with client"
  - "Record taxi expense of $25"
  
- **Update task**:
  - "Update the description to 'Working on API integration'"
  - "Mark current task as billable"
  - "Add feeling rating of 4"

### Project Management
- **List projects**:
  - "Show me all my projects"
  - "List active projects"
  - "What projects do I have?"
  
- **Create project**:
  - "Create a new project called 'Website Redesign'"
  - "Add project 'Mobile App v2' with default billable tasks"
  
- **Update project**:
  - "Archive the old website project"
  - "Rename project X to 'Client Portal'"

### Task Management
- **List tasks**:
  - "Show today's tasks"
  - "List all running tasks"
  - "What did I work on yesterday?"
  
- **Create task**:
  - "Create a 2-hour task for ProjectX from 9am to 11am"
  - "Log 4 hours on the API project for yesterday"
  
- **Update task**:
  - "Mark task X as paid"
  - "Update task description"
  - "Change task to non-billable"

## Available Tools

### Timer Operations
- `timer_start` - Start timer for a project
- `timer_stop` - Stop the running timer
- `timer_pause` - Pause the timer (start break)
- `timer_resume` - Resume timer after break
- `timer_status` - Check current timer status
- `timer_update` - Update running timer details

### Task Enhancements
- `task_add_note` - Add note to current task
- `task_add_expense` - Add expense to current task
- `task_add_pause` - Add manual pause to current task

### Project Management
- `project_list` - List all projects
- `project_create` - Create new project
- `project_update` - Update existing project
- `project_delete` - Delete project

### Task Management
- `task_list` - List tasks with filters
- `task_create` - Create new task
- `task_update` - Update existing task
- `task_delete` - Delete task

### Authentication
- `auth_configure` - Set API authentication

## Getting Your API Token

1. Log in to your Timesheet account
2. Go to Settings → API Access
3. Generate a new API token
4. Copy the token and add it to your configuration

## Development

```bash
# Clone the repository
git clone https://github.com/timesheet/timesheet-mcp.git
cd timesheet-mcp

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Troubleshooting

### Timer not starting?
- Ensure you have a valid API token configured
- Check that the project ID exists in your account
- Verify you have permission to create tasks for the project

### Authentication errors?
- Double-check your API token is correct
- Ensure the token hasn't expired
- Try generating a new token from your Timesheet settings

## License

MIT

## Support

For issues and feature requests, visit: https://github.com/timesheet/timesheet-mcp/issues
