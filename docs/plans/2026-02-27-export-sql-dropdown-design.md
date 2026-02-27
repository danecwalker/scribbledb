# Export SQL Dropdown — Design

## Overview

Add a custom dropdown menu button to the Diagram toolbar that exports the current DBML schema to various database SQL formats using `@dbml/core`'s `ModelExporter.export()`.

## Supported Formats

| Format     | Extension | Notes                          |
|------------|-----------|--------------------------------|
| PostgreSQL | `.sql`    |                                |
| MySQL      | `.sql`    |                                |
| MSSQL      | `.sql`    |                                |
| Oracle     | `.sql`    |                                |
| DBML       | `.dbml`   | includeRecords option          |
| JSON       | `.json`   | isNormalized option            |

## UI Placement

In the Diagram toolbar alongside existing SVG/PNG/Share buttons. An "Export SQL" button with a chevron-down icon opens a floating dropdown menu below the button.

## Interaction

1. Click "Export SQL" button — dropdown appears
2. Click a format — generates SQL and downloads the file
3. Click outside or select a format — dropdown closes

## Export Logic

- Parse current DBML source with `Parser.parse(source, 'dbml')`
- Export with `ModelExporter.export(database, format)`
- Trigger file download with correct extension
- Button disabled when source has parse errors

## Styling

Catppuccin Mocha theme matching existing toolbar buttons:
- Button: `rounded bg-[#313244] px-3 py-1 text-xs text-[#cdd6f4] hover:bg-[#45475a]`
- Menu: floating, same background, hover highlight on items
- Click-outside-to-close via window click listener

## Files Modified

- `src/lib/components/Diagram.svelte` — add dropdown button, menu, export logic
- `src/lib/dbml/parser.ts` — export a function that returns the raw Database object (for ModelExporter)
