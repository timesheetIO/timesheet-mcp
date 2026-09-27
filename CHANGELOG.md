# Changelog

## [2.0.2] - 2026-09-27

### Fixed
- Results name the IDs a follow-up call needs in their text. Hosts that show a widget, such as
  claude.ai, give the model only that text, so asking Claude to start a timer on a project made it
  guess the project ID. Time entries also give their date, times and project there.
- Every tool carries `annotations.title`, which the Claude directory lists. The 41 core tools set
  only the top-level `title`.
- `contract_create` and `contract_update` describe work days as the API stores them: seven
  characters from Monday, 1 for a work day and 0 for a day off, such as `1111100`. The old example
  `MTWTF--` saved a contract without work days.
- The widgets report version 2.0.2 to the host instead of 2.0.0.

## [2.0.1] - 2026-09-27

### Fixed
- The `summarize` option of `export_generate` and `export_template_create` is described as what
  it does: it adds a totals row after the entries. The old text said it replaced the entries, so
  clients left it off when a user asked for totals.

## [2.0.0] - 2026-09-24

### Breaking
- Built on the v2 MCP SDK (`@modelcontextprotocol/server` and `@modelcontextprotocol/node`).
  `TimesheetMCPServer.getServer()` now returns a v2 `Server`, and `runStdio()` returns its handle
  synchronously. Running the server with `npx @timesheet/mcp` or the hosted endpoint is unaffected.
- Requires Node.js 20 or higher.
- The hosted endpoint no longer offers `auth_configure`. Each request brings its own credentials
  there, so the tool changed nothing and still reported success. The local server keeps it.
- The `/components` route and the separate component server are gone. They served the widget
  files over plain HTTP before MCP Apps resources existed.

### Added
- MCP 2026-07-28 support next to the earlier protocol versions, on the same endpoint and over
  stdio. 2026 clients get `server/discover` and cache hints; current clients keep the same path.
- Result cards (MCP Apps) for `task_create` and `task_update`, the export tools and the absence
  tools. A pending absence can be cancelled from its card.
- The hosted server answers requests without credentials with a 401 and a `WWW-Authenticate`
  header pointing at the protected resource metadata, so OAuth clients can sign in. API keys
  (`Bearer ts_...`) keep working.
- `report_document_pdf`, `report_task_pdf`, `report_expense_pdf` and `report_note_pdf` attach the
  PDF to the result (up to 5 MB). They used to generate it and drop it.
- `timer_stop` reports the entry it saved, and the timer card shows it with a way to start again.
- `task_list` reports how many entries match across all pages, and `statistics_get` says when it
  could not read every entry (over 5,000).
- `timer_update` accepts the start time, entry type, distance and phone number, so the timer
  card's edit form saves every field.
- `TIMESHEET_REPORTS_URL` points the reports API somewhere else, as `TIMESHEET_API_URL` does for
  the API.
- The MCP Registry entry lists the hosted server, and each release publishes it.

### Changed
- The widgets are redesigned as cards that follow the host's light or dark theme and language,
  and are about 590 KB each instead of 770 KB to 1.2 MB.
- Widget actions update the model context instead of posting a chat message, and the timer no
  longer polls.
- Protocol errors follow the v2 SDK: an unknown tool returns -32602, and messages no longer start
  with `MCP error N:`.
- The authorization server metadata on the MCP origin is a live copy of the API's.
- `statistics_get` accepts ranges of up to a year (366 days).
- The HTTP server listens on 127.0.0.1 unless `HOST` is set. The container image sets 0.0.0.0.

### Security
- A tool named after an object property such as `constructor` returned the server's API client,
  credentials included. Tool names now resolve to tools only.
- `statistics_get` with a range such as 1970 to 9999 built millions of daily rows and ran the
  server out of memory. Such ranges are now refused before any API call.
- An OAuth access token the API no longer accepts, for example after signing out, gets a 401 with
  `invalid_token` instead of failing every tool call, so the client refreshes or signs in again.
- When the HTTP server runs on `TIMESHEET_API_TOKEN`, a web page from another origin can no longer
  use that key, and the CORS patterns are anchored. JSON-RPC batches are limited to 20 requests.
- The widget libraries are build-time dependencies now, and four unused packages are gone, so an
  install pulls in 128 fewer packages and the runtime dependencies have no known vulnerabilities.
  axios is held at 1.20 or later until `@timesheet/sdk` 1.3.2 ships it.

### Fixed
- `timer_update` declared an output schema its result did not match, so clients that check
  results rejected every update. The timer tools now declare what they return, and a test checks
  every tool's result against its schema.
- A tool call without `arguments` failed with a protocol error for several tools.
- `export_from_template` returns a download link instead of dropping the file.
- `format: "pdf"` on `export_generate` and `export_send` delivers a real PDF. The reports service
  used to write an Excel workbook under a `.pdf` name; it now renders every report type as a PDF
  table (needs the reports service from the same release).
- Statistics are exact up to 5,000 entries (they stopped at 500), entries that two pages both
  return are counted once, and daily bars no longer shift by a day east of UTC.
- Project colours set in the Android app show in the cards, and a project without a colour no
  longer turns black.
- The timer text for the model names the project and description.
- Cards whose tool failed or was cancelled show that, instead of loading forever.
- A card action that fails shows an error and is not reported to the model as done. Forms keep
  what was typed.
- Times from the cards carry the local offset instead of UTC, so an entry started near midnight
  no longer lands on the wrong day.
- The timer card's edit form saves every field, and the start can move to an earlier day. The
  expense form's "Refunded" switch is saved. The timer lists all projects, not only the first 100.
- Durations no longer show a minute short, and numbers, dates, filter names and form texts
  follow the host's language.
- A link the host refuses to open offers its URL to copy, and is not reported as downloaded.
- The cards follow the system theme when the host sends none, keep clear of safe areas in
  fullscreen, and hide tool buttons in hosts that cannot call tools.
- Contrast meets WCAG AA (focus rings, dropdowns, badges, chart bars, dark mode text), tap
  targets are at least 44px, and the export card's fields are labelled for screen readers.

## [1.2.1] - 2026-09-01

### Fixed
- Server now starts under `npx`. The main-guard compared `import.meta.url` against
  `process.argv[1]`, but npx runs the bin through a symlink in `node_modules/.bin`, so
  argv[1] was the link while `import.meta.url` was the real file. The guard was never
  true, nothing started, and the process exited 0 in silence. This is the same failure
  1.2.0 fixed for Windows, arriving by a different route. Both entry points (`index.ts` and
  `component-server.ts`) now resolve the entry path with `realpathSync` before comparing.

### Changed
- Package metadata for npm: `homepage` now points at timesheet.io, and `author` is
  normalized to `timesheet.io <support@timesheet.io>` across every Timesheet package.
- Copyright reassigned from the previous holder to `Timesheet - Mobile Time Tracking OG`,
  the registered company. The license itself is unchanged.

## [1.2.0] - 2026-05-29

### Changed
- Upgraded `@timesheet/sdk` to `1.2.0`
- List tools now call the SDK `search()` endpoint so filters that the plain list endpoint silently ignored are applied server-side: `absence_list`, `organization_list`, `todo_list`, `rate_list`, `note_list`, `expense_list`, `pause_list`, and the `team_list` / `project_list` tools

### Fixed
- Server now starts on Windows: the `import.meta.url === file://${process.argv[1]}` main-guard was always false on Windows (backslash argv path vs forward-slash file URL), so the process exited silently with code 0 and every stdio MCP client (Claude Desktop, Claude Code, Cursor) saw the connection close immediately. Both the stdio server (`index.ts`) and the component server (`component-server.ts`) now compare against `pathToFileURL(process.argv[1]).href`, which is correct on all platforms
- `contract_list` now filters by user: the SDK renamed `ContractListParams.userId` to `user`, so the value was previously sent under a parameter the API did not recognize and was ignored (the tool still accepts `userId` and maps it internally)
- Statistics aggregation no longer references the removed `Task.projectId` field; it reads the nested project object instead

## [1.1.0] - 2026-02-07

### Added
- **`statistics_get` MCP Tool**: New tool for aggregated time tracking statistics
  - Required params: `startDate`, `endDate` for defining the analysis period
  - Optional filters: `projectId`, `projectIds`, `teamId`, `teamIds`, `tagIds`, `userIds`, `filter`
  - Server-side aggregation: total hours, billable/non-billable breakdown, break hours, task count
  - Project breakdown with hours, percentage, task count per project
  - Daily hours with billable/non-billable/break split and zero-day fill
  - Weekly hours auto-computed when date range exceeds 14 days (grouped by ISO week)
  - Paginates up to 500 tasks (5 pages) for detailed breakdowns
- **Recharts Statistics Widget**: Interactive charts replacing CSS-based visualizations
  - `DailyChart`: Stacked `BarChart` with billable (green) and non-billable (amber) bars
  - `ProjectBreakdown`: Donut `PieChart` with project colors from SDK and side legend
  - `chartTheme.ts`: Theme-aware color palettes for light/dark mode
  - Auto-switches between daily and weekly chart views based on data range
  - Date range subtitle in widget header
  - 4-column summary grid (Total Hours, Billable Hours, Billable %, Tasks)
- **MCP Apps SDK Migration** (SEP-1865): Standardized widget communication protocol
  - `McpAppProvider.tsx` wraps all widget roots with `useApp()` hook
  - URI scheme: `ui://timesheet/<component>.html`
  - MIME type: `text/html;profile=mcp-app`
  - Metadata namespace: `_meta.ui.*` with OpenAI backward compatibility keys retained
  - `useDocumentTheme` from ext-apps/react replaces old theme hook

### Changed
- `Statistics` type interface extended with `nonBillableHours`, `totalTasks`, `totalBreakHours`, `startDate`/`endDate`, and richer project/daily/weekly breakdown fields
- `formatStatisticsResponse` now provides detailed text fallback with date range, project breakdown list, and daily summary for non-widget MCP clients
- Widget hooks (`useToolOutput`, `useCallTool`, `useTheme`, `useDisplayMode`) backed by MCP Apps SDK while preserving identical signatures
- `tsconfig.json` upgraded to `"module": "node16"` + `"moduleResolution": "node16"` for package.json `exports` support

### Removed
- `src/openai-helpers.ts` replaced by `src/mcp-app-helpers.ts`

### Dependencies
- Added `recharts` ^2.15.0
- Added `@modelcontextprotocol/ext-apps` ^1.0.1

## [1.0.4] - 2026-01-06

### Added
- OAuth 2.1 Authorization Server Metadata endpoint with PKCE support
  - `code_challenge_methods_supported: ['S256']` for ChatGPT compatibility
  - `authorization_endpoint`, `token_endpoint`, `registration_endpoint`
  - Serves metadata directly instead of redirecting

### Fixed
- Set `MCP_SERVER_URL` in Cloud Build for correct OAuth resource identifier
- Debug logging for environment variable troubleshooting

## [1.0.3] - 2026-01-06

### Added
- **Landing Page**: Modern dark-themed landing page at mcp.timesheet.io root
  - Installation instructions for Claude Code, Claude Desktop, and ChatGPT
  - Feature cards with gradient icons
  - Copy-to-clipboard code blocks
  - Responsive design with timesheet.io branding
- **Root URL Routing**: Serve landing page on GET, MCP protocol on POST at root
  - Content negotiation based on Accept header and User-Agent
  - Clean URL structure (mcp.timesheet.io instead of mcp.timesheet.io/mcp)
- **Reports API - Document Reports**: New tools for document/invoice data and PDF generation
  - `report_document_get` - Retrieve formatted document data with tasks, expenses, and financials
  - `report_document_pdf` - Generate PDF version of documents/invoices
  - `report_document_xml` - Generate e-invoicing XML (Zugferd, XRechnung, ebInterface)
- **Reports API - Task Reports**: New tools for task report data and PDFs
  - `report_task_get` - Retrieve formatted task data with time tracking and rates
  - `report_task_pdf` - Generate PDF report for a task
- **Reports API - Expense Reports**: New tools for expense report data and PDFs
  - `report_expense_get` - Retrieve formatted expense data with amounts
  - `report_expense_pdf` - Generate PDF report with receipt images
- **Reports API - Note Reports**: New tools for note report data and PDFs
  - `report_note_get` - Retrieve formatted note data with content
  - `report_note_pdf` - Generate PDF report with attachments
- **Reports API - Export Generation**: New tools for timesheet exports
  - `export_generate` - Generate Excel/CSV/PDF exports with filters and options
  - `export_send` - Send exports directly via email
  - `export_from_template` - Generate exports using saved templates
- **Reports API - Export Configuration**: New tools for export customization
  - `export_fields` - Get available export fields/columns
  - `export_report_types` - Get available report types
- **Reports API - Export Templates**: New tools for template management
  - `export_template_list` - List saved export templates
  - `export_template_get` - View template details
  - `export_template_create` - Save export configuration as template
  - `export_template_update` - Modify existing templates
  - `export_template_delete` - Delete templates
- **ExportWidget**: Interactive React widget for ChatGPT integration
  - Template selector dropdown with format indicators
  - Date range inputs with quick presets (This Month, Last Month, This Week, Last Week)
  - Template details display with format, summarize, and filter badges
  - Generate button with loading state and result feedback
  - Calls `export_from_template` via `useCallTool` hook
- Tag display in TaskList widget with colored chips
- TagList and TagItem components for displaying task tags
- Automatic tag population in task_list tool (populateTags default: true)
- Contrasting text color calculation for tag backgrounds
- Table-row layout for TaskListItem with 3 columns (time, details, duration)
- i18n translations for TaskList component strings (English and German)
- **Cloud Run Deployment**: Production-ready container deployment
  - Multi-stage Dockerfile for optimized builds
  - Cloud Build configuration (`cloudbuild.yaml`) for GitHub CI/CD
  - `.dockerignore` for efficient Docker builds
  - CORS configuration for Cloud Run domains

### Changed
- Enhanced all tool definitions with detailed titles and user-friendly descriptions
- Added comprehensive output schemas to document return values for all tools
- Added tool annotations (readOnlyHint, destructiveHint) for better UX
- Improved parameter descriptions with format specifications (date-time, date formats)
- Added validation constraints (minLength, minimum, maximum) to parameters
- Refactored Tailwind configuration to use CSS custom properties for theme colors
- TaskListItem now displays description and tags below project title
- Extracted hardcoded strings to i18n translation files in TaskListView and TaskListItem

## [1.0.1] - 2025-01-14

### Added
- Support for TIMESHEET_API_URL environment variable (undocumented, for testing)

### Fixed
- CI/CD pipeline issues
- Test suite compatibility
- npm publish workflow

## [1.0.0] - 2025-01-14

### Added
- Initial release of Timesheet MCP Server
- Timer management tools (start, stop, pause, resume, status, update)
- Task enhancement tools (add notes, expenses, pauses)
- Project management tools (list, create, update, delete)
- Task management tools (list, create, update, delete)
- Natural language support for timer operations
- Authentication configuration tool
- Comprehensive error handling
- Full integration with @timesheet/sdk
- Example usage documentation
- Support for retroactive time entries