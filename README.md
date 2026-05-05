# Sententia

![Preview](src/images/preview.jpg)

> *"Sententia"* — Latin for thought, opinion, or maxim.

A minimal quote display built from my personal reading highlights. I use a [Supernote Nomad](https://supernote.com) e-ink reader, which has a lovely feature: highlighted passages from any ebook are automatically collected into a digest page. The problem is that browsing them on e-ink is slow and a bit cumbersome. Sententia is the fix — a clean, fast second home for those quotes, always ready on any screen.

---

## What It Does

The deployed app is intentionally simple: one quote at a time, full-screen, with a readable overlay on a background image. Navigate forward and backward through your highlights, and the app remembers where you left off.

**Public display**
- Random quote rotation with previous-history navigation
- Keyboard shortcuts: `→` or `Space` for next, `←` for previous
- Last-viewed quote persists in `localStorage`
- English-only pool for now (German quotes are stored and ready for a future toggle)
- Full-screen background with Averia Serif Libre typography via Google Fonts

**Local quote editor**
- Admin UI available when running the local backend
- Search and filter by text, author, or book
- Edit quote text and metadata, or delete entries
- Slider to set a max display length (60–1000 chars, or unlimited) — useful for keeping the public view readable
- All edits write directly to the JSON source files

---

## How It Works

### Data pipeline

Highlights are exported from the Supernote as a plain-text file. I manually clean them into a strict two-line format:

```text
Quote text
Book Title - Author Name
```

A TypeScript parser then transforms that file into structured JSON — detecting language, formatting long quotes into readable line breaks, removing duplicates, and sorting by book and quote text.

### Editing workflow

The app is static by design. To edit quotes:

```bash
npm run dev:full   # starts Express backend + Vite frontend
```

Then open `http://127.0.0.1:5176/supernote-quote/#/admin`, make changes in the UI, and commit the updated JSON files. GitHub Actions handles the rest.

### Deployment

Every push to `main` triggers a GitHub Actions build that publishes the `dist` folder to GitHub Pages. No server required in production — just static files.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React 19 + TypeScript |
| Styling | Plain CSS (no UI framework) |
| Build | Vite |
| Local backend | Express.js (local editing only) |
| Data | JSON files in version control |
| Hosting | GitHub Pages + GitHub Actions |

---

## Project Structure

src/
App.tsx              # Quote display, routing, admin UI
App.css              # Public and admin styles
quotes-api.ts        # Frontend client for local editing API
data/
quotes.json        # Structured quote data (deployed with app)
config.json        # Display settings
images/
background.jpg     # Full-screen background
server/
index.ts             # Local Express API
quotes-store.ts      # JSON read/write for quotes
config-store.ts      # JSON read/write for display config
scripts/
parse-supernote-quotes.ts   # Highlights → JSON parser
data/raw/
Documents.txt               # Preserved raw Supernote export
quotes_normalized.txt       # Manually curated parser input

---

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Public app only
npm run dev:full     # Public app + local editor backend
npm run parse:quotes # Re-parse highlights export → quotes.json
npm run build        # Production build
npm run preview      # Preview production build locally
```

---

## Deployment Setup

In your repository settings, set GitHub Pages to deploy from the `gh-pages` branch at `/ (root)`. The workflow also supports manual runs from the Actions tab via `workflow_dispatch`.

Vite is configured with `base: "/supernote-quote/"` and routing is hash-based, so the admin route is safe on static hosting — it just shows a friendly message if the local backend isn't running.