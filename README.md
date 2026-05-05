# Supernote Quote

A minimal static quote display built from a Supernote highlights export.

GitHub Pages hosts the public app as static files. The deployed app reads the bundled [src/data/quotes.json](src/data/quotes.json) file only. Quote editing is intentionally local: run the local backend, edit or delete quotes in the admin UI, then commit and push the changed JSON file.

## Public Quote Display

- English-only quote rotation for now
- Random next quote with previous-history navigation
- Keyboard shortcuts: `ArrowRight` or `Space` for next, `ArrowLeft` for previous
- Current quote persistence in `localStorage`
- Full-screen `src/images/background.jpg` with a readable overlay
- Averia Serif Libre typography via Google Fonts, with Georgia/serif fallbacks
- Static data from `src/data/quotes.json`

## Local Quote Editing

Editing is available only while the local JSON-writing backend is running:

```bash
npm run dev:full
```

Then open:

```text
http://127.0.0.1:5176/supernote-quote/#/admin
```

The admin UI calls the local API and writes changes directly to [src/data/quotes.json](src/data/quotes.json). After editing, commit and push that file so GitHub Pages deploys the updated static data.

If the backend is not running, `#/admin` shows:

```text
Admin editing is only available locally. Run npm run dev:full.
```

## Data Pipeline

The raw Supernote export is preserved at [data/raw/Documents.txt](data/raw/Documents.txt). Quotes are manually cleaned into [data/raw/quotes_normalized.txt](data/raw/quotes_normalized.txt), then the parser at [scripts/parse-supernote-quotes.ts](scripts/parse-supernote-quotes.ts) transforms that curated file into [src/data/quotes.json](src/data/quotes.json).

`quotes_normalized.txt` uses one strict format:

```text
Quote text
Book Title - Author Name
```

Entries are separated by a blank line. During parsing, the script:

- Reads exactly two lines per entry from `quotes_normalized.txt`
- Splits the source line on the first ` - ` into title and author
- Formats long quotes with readable line breaks
- Detects English vs German and keeps the `language` field for future use
- Removes exact duplicate quote text
- Truncates extremely long display text while preserving `fullText`
- Sorts the output by book title and quote text

## Commands

Install dependencies:

```bash
npm install
```

Run the public app only:

```bash
npm run dev
```

Run the public app plus local quote editor backend:

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

## Deployment

The GitHub Actions workflow at [.github/workflows/deploy.yml](.github/workflows/deploy.yml) runs on pushes to `main`, installs dependencies with `npm ci`, builds the Vite app, and deploys `dist` to GitHub Pages.

Vite is configured with `base: "/supernote-quote/"`, and routing is hash-based so the admin URL is safe on static hosting. The deployed admin screen cannot edit quotes because GitHub Pages cannot run the local Express backend.

## Project Structure

- [src/App.tsx](src/App.tsx): public quote display, hash routing, and local admin UI
- [src/App.css](src/App.css): public screen and admin styling
- [src/quotes-api.ts](src/quotes-api.ts): frontend client for the local editing API
- [server/index.ts](server/index.ts): local Express API server
- [server/quotes-store.ts](server/quotes-store.ts): JSON-backed quote store
- [scripts/parse-supernote-quotes.ts](scripts/parse-supernote-quotes.ts): normalized quotes-to-JSON parser
- [src/images/background.jpg](src/images/background.jpg): full-screen background image
- [data/raw/Documents.txt](data/raw/Documents.txt): preserved raw highlights export
- [data/raw/quotes_normalized.txt](data/raw/quotes_normalized.txt): manually curated parser input
- [src/data/quotes.json](src/data/quotes.json): structured quote data deployed with the app
