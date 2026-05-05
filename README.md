# Supernote Quote

A minimal quote display and local quote-management workflow built from a Supernote highlights export.

The public screen shows one English quote at a time over a full-screen background image, using Averia Serif Libre for a soft handwritten serif feel. The local admin screen lets you search, edit, and delete quotes from the generated JSON file.

## Public Quote Display

- English-only public quote rotation
- Random next quote with previous-history navigation
- Keyboard shortcuts: `ArrowRight` or `Space` for next, `ArrowLeft` for previous
- Current quote persistence in `localStorage`
- Full-screen `src/images/background.jpg` support with a subtle readability overlay
- Averia Serif Libre typography via Google Fonts, with Georgia/serif fallbacks
- Static-site friendly build with a JSON fallback

## Data Pipeline

The raw Supernote export is preserved at [data/raw/Documents.txt](data/raw/Documents.txt). The parser at [scripts/parse-supernote-quotes.ts](scripts/parse-supernote-quotes.ts) transforms that export into [src/data/quotes.json](src/data/quotes.json).

During parsing, the script:

- Reads repeated quote/source blocks from `Documents.txt`
- Normalizes whitespace and repairs common export encoding artifacts
- Cleans `.epub`, archive, hash, and ISBN-like metadata from book titles
- Extracts authors from obvious metadata patterns
- Detects English vs German and keeps the `language` field for future use
- Removes exact duplicate quotes
- Sorts the output by book title and quote text

## Local Quote Management

Run the frontend plus backend, then open `/admin` to manage quotes locally. The backend reads and writes [src/data/quotes.json](src/data/quotes.json).

Available local API endpoints:

- `GET /api/quotes`
- `PATCH /api/quotes/:id` for `text`, `bookTitle`, and `author`
- `DELETE /api/quotes/:id`

The `/admin` route and JSON-writing backend are intended for local use only. Do not expose them in production without authentication, authorization, and a more durable storage plan.

## Commands

Install dependencies:

```bash
npm install
```

Run frontend only:

```bash
npm run dev
```

Run frontend plus local backend:

```bash
npm run dev:full
```

Parse the Supernote export:

```bash
npm run parse:quotes
```

Build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Project Structure

- [src/App.tsx](src/App.tsx): public quote display and local admin UI
- [src/App.css](src/App.css): public screen and admin styling
- [src/quotes-api.ts](src/quotes-api.ts): frontend API client with static fallback
- [server/index.ts](server/index.ts): Express API server
- [server/quotes-store.ts](server/quotes-store.ts): JSON-backed quote store
- [src/images/background.jpg](src/images/background.jpg): full-screen background image
- [data/raw/Documents.txt](data/raw/Documents.txt): preserved raw highlights export
- [src/data/quotes.json](src/data/quotes.json): structured quote data used by the app
- [scripts/parse-supernote-quotes.ts](scripts/parse-supernote-quotes.ts): export-to-JSON parser
