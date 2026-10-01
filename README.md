[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/timesheetio-timesheet-mcp-badge.png)](https://mseep.ai/app/timesheetio-timesheet-mcp)

# Timesheet MCP Server

[![npm version](https://img.shields.io/npm/v/@timesheet/mcp.svg)](https://www.npmjs.com/package/@timesheet/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/@timesheet/mcp.svg)](https://nodejs.org)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io)

Control [Timesheet](https://timesheet.io) with natural language from AI assistants such as ChatGPT, Claude, Claude Code, Cursor, and VS Code. Start and stop timers, log past work, pull statistics and exports, request time off, and manage projects and teams by chatting.

The server supports the current version of the Model Context Protocol (2026-07-28) and the earlier ones, so it works with new and older clients alike. The full guide is at [docs.timesheet.io](https://docs.timesheet.io/integrations/mcp-server).

## Two ways to connect

| | Hosted server | Local server |
|---|---|---|
| **Address** | `https://mcp.timesheet.io` | Runs on your computer with `npx -y @timesheet/mcp` |
| **Sign-in** | Your Timesheet account (OAuth 2.1), or an API key | An API key |
| **Requirements** | None | Node.js 20 or higher |

Both offer the same tools. You need a Timesheet Pro plan or above, which includes API access.

## Get an API key

In the Timesheet web app, go to **Integrations** > **API Keys**, select **New API Key**, and copy the key. The same key works for the hosted server, the local server, and the [Timesheet API](https://api.timesheet.io).

## Use the hosted server

**ChatGPT:** turn on developer mode, add a connection with the URL `https://mcp.timesheet.io`, and sign in with your Timesheet account when asked.

**Claude Code** with an API key:

```bash
claude mcp add --transport http --scope user timesheet https://mcp.timesheet.io --header "Authorization: Bearer your-api-token-here"
```

**Cursor** (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "timesheet": {
      "url": "https://mcp.timesheet.io",
      "headers": { "Authorization": "Bearer your-api-token-here" }
    }
  }
}
```

## Use the local server

**Claude Code:**

```bash
claude mcp add timesheet --scope user -e TIMESHEET_API_TOKEN=your-api-token-here -- npx -y @timesheet/mcp
```

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows), and other clients with the same format:

```json
{
  "mcpServers": {
    "timesheet": {
      "command": "npx",
      "args": ["-y", "@timesheet/mcp"],
      "env": {
        "TIMESHEET_API_TOKEN": "your-api-token-here"
      }
    }
  }
}
```

Restart the client after you change its configuration. The [guide](https://docs.timesheet.io/integrations/mcp-server) has the setup for VS Code and other clients.

## Example prompts

- "Start the timer for the website project"
- "Pause my timer, I'm taking lunch", then "Stop the timer"
- "Log 2 hours on the API project for Monday"
- "What did I work on yesterday?"
- "How many billable hours did I track in September?"
- "Email the September timesheet for Acme as a PDF to billing@acme.com"
- "Book me off next Friday"
- "Who on my team is tracking right now?"

## Tools

The server offers more than 100 tools. The assistant picks the right ones, so you do not need to name them.

| Area | What the tools do |
|------|-------------------|
| Timer | Start, pause, resume, stop, and edit the running timer |
| Time entries | List, create, update, and delete entries, and add notes, expenses, and breaks |
| Statistics | Totals, billable hours, and per-project and daily breakdowns for up to a year |
| Reports and exports | Excel, CSV, and PDF exports, export templates, and PDFs of documents, tasks, expenses, and notes |
| Projects, todos, and tags | Manage projects and their members, todos, tags, and rates |
| Time off and contracts | Request, approve, and cancel absences, and manage absence types and contracts |
| Teams and organizations | Manage members and invitations, and see who is tracking time right now |
| Account | View and update your profile and settings |

The [guide](https://docs.timesheet.io/integrations/mcp-server#available-tools) lists every tool.

## Interactive cards

In clients that support MCP Apps, such as ChatGPT and Claude, the timer, new and changed time entries, statistics, exports, and absence requests appear as interactive cards. They follow the client's light or dark theme and language. Other clients show the same information as text.

## Development

```bash
npm install
npm run build       # server and widgets
npm test            # unit tests
npm run test:e2e    # both protocol versions over stdio and HTTP, against the build
npm run dev         # HTTP server on http://127.0.0.1:3000
```

The HTTP server uses `TIMESHEET_API_TOKEN` for requests that bring no credentials, so leave it unset whenever the server can be reached from outside your computer. See `.env.example` for the other settings.

## Troubleshooting

- **Nothing responds, or you get an authentication error:** check that `TIMESHEET_API_TOKEN` is set without extra spaces or quotes, and that the key still exists in **Integrations** > **API Keys**.
- **The command is not found:** check that Node.js 20 or higher is installed with `node --version`.
- **A tool reports that it needs a higher plan:** the MCP server works with a Pro plan or above.

## License

MIT, see [LICENSE.md](LICENSE.md).

## Support

Report problems and ideas at [github.com/timesheetIO/timesheet-mcp/issues](https://github.com/timesheetIO/timesheet-mcp/issues).
