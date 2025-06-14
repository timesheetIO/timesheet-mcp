# Release Notes

## v1.0.0 (2025-01-14)

### 🎉 Initial Release

The first public release of the Timesheet MCP Server, bringing natural language time tracking to Claude Desktop, Cursor, and other MCP-compatible clients.

### ✨ Features

#### Timer Management
- **Start Timer**: `"Start timer for ProjectX"` or `"Start timer for ProjectX 10 minutes ago"`
- **Stop Timer**: `"Stop working"` or `"I'm done for today"`
- **Pause/Resume**: `"Taking a break"` / `"Back to work"`
- **Status Check**: `"What's my timer status?"`
- **Update Running Task**: Change description, billable status, mood rating

#### Task Enhancements
- **Add Notes**: `"Add note: Fixed the login bug"`
- **Record Expenses**: `"Add expense: $45 for client lunch"`
- **Manual Pauses**: Add breaks retroactively

#### Project & Task Management
- List, create, update, and delete projects
- Full CRUD operations for tasks
- Filter by date, status, or project

### 📦 Installation

```bash
# Quick start with npx (no installation)
npx @timesheet/mcp

# Global installation
npm install -g @timesheet/mcp

# Configure in Claude Desktop
{
  "mcpServers": {
    "timesheet": {
      "command": "npx",
      "args": ["@timesheet/mcp"],
      "env": {
        "TIMESHEET_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

### 🔧 Technical Details
- Built with TypeScript and @modelcontextprotocol/sdk
- Uses official @timesheet/sdk for API integration
- Supports Node.js 18.x and 20.x
- GitHub Actions CI/CD pipeline
- Basic test suite included

### 📝 Documentation
- Comprehensive README with examples
- Sample prompts for all operations
- API token setup instructions
- Troubleshooting guide

### 🙏 Acknowledgments
Thanks to the Anthropic team for the Model Context Protocol specification and to all early testers who provided feedback.

---

For questions or issues, please visit: https://github.com/timesheetIO/timesheet-mcp/issues