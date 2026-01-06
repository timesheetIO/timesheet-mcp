# Changelog

## [1.0.3] - Unreleased

### Added
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