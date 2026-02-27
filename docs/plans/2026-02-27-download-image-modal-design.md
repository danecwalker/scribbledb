# Download Image Modal — Design

## Overview

Replace the separate SVG and PNG toolbar buttons with a single "Download Image" button that opens a modal with format, theme, and background options.

## Modal Options

| Option     | Choices                | Default     |
|------------|------------------------|-------------|
| Format     | SVG, PNG               | PNG         |
| Theme      | Dark, Light            | Dark        |
| Background | Solid, Transparent     | Solid       |

## Theme Color Maps

**Dark (current Catppuccin Mocha):**
- Canvas bg: `#11111b`
- Header bg: `#252538`
- Body bg: `#1e1e2e`
- Text: `#cdd6f4`
- Muted text: `#6c7086`
- Borders: `#313244`
- Edges: `#585b70`
- Subtle text: `#7f849c`

**Light (Catppuccin Latte):**
- Canvas bg: `#eff1f5`
- Header bg: `#e6e9ef`
- Body bg: `#ffffff`
- Text: `#4c4f69`
- Muted text: `#8c8fa1`
- Borders: `#ccd0da`
- Edges: `#9ca0b0`
- Subtle text: `#7c7f93`

## Background Behavior

- **Solid**: Background rect filled with theme canvas color
- **Transparent**: No background rect. PNG canvas transparent. SVG has no fill.

## Export Approach

Modify `buildCleanSVG()` to accept theme and background options. After cloning the SVG and serializing, do string replacements on the dark colors to swap to light theme values when light is selected. For transparent background, skip inserting the background rect.

## Toolbar Change

Remove SVG and PNG buttons. Add single "Download Image" button that opens the modal.

## Files Modified

- `src/lib/components/Diagram.svelte` — replace SVG/PNG buttons with Download Image button + modal, refactor buildCleanSVG to support themes
