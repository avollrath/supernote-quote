# Supernote Quote

A minimal full-screen quote display built from a Supernote highlights export. It shows one quote at a time in large, quiet typography, with the book title and author tucked underneath.

## Features

- Random quote display with previous/next navigation
- Language filtering for All, English, and Deutsch
- Keyboard shortcuts: `ArrowRight` or `Space` for next, `ArrowLeft` for previous
- Local persistence for selected language and current quote
- Static-site friendly Vite build
- Responsive, warm, uncluttered reading interface

## Data Pipeline

The raw Supernote export is preserved at [data/raw/Documents.txt](data/raw/Documents.txt). The parser at [scripts/parse-supernote-quotes.ts](scripts/parse-supernote-quotes.ts) transforms that export into [src/data/quotes.json](src/data/quotes.json).

During parsing, the script:

- Reads repeated quote/source blocks from `Documents.txt`
- Normalizes whitespace and repairs common export encoding artifacts
- Cleans `.epub`, archive, hash, and ISBN-like metadata from book titles
- Extracts authors from obvious metadata patterns
- Detects English vs German with a practical heuristic
- Removes exact duplicate quotes
- Sorts the output by book title and quote text

## Local Setup

```bash
npm install
npm run parse:quotes
npm run dev
```

## Build

```bash
npm run lint
npm run build
npm run preview
```

## Project Structure

- [src/App.tsx](src/App.tsx): quote state, filtering, navigation, persistence, and shortcuts
- [src/App.css](src/App.css): full-screen reading UI
- [data/raw/Documents.txt](data/raw/Documents.txt): preserved raw highlights export
- [src/data/quotes.json](src/data/quotes.json): structured quote data used by the app
- [scripts/parse-supernote-quotes.ts](scripts/parse-supernote-quotes.ts): export-to-JSON parser
