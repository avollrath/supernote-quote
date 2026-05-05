# Supernote Quote

A minimal production-ready quote display built from a Supernote highlights export.

GitHub Pages hosts the static React app. Supabase provides production quote storage plus authenticated editing at `#/admin`. The bundled `src/data/quotes.json` remains a static fallback so the public quote screen still works if Supabase is not configured or temporarily unavailable.

## Public Quote Display

- English-only quote rotation for now
- Random next quote with previous-history navigation
- Keyboard shortcuts: `ArrowRight` or `Space` for next, `ArrowLeft` for previous
- Current quote persistence in `localStorage`
- Full-screen `src/images/background.jpg` with a readable overlay
- Averia Serif Libre typography via Google Fonts, with Georgia/serif fallbacks
- Static fallback from `src/data/quotes.json`

## Production Editing

Supabase stores quotes in the `public.quotes` table. Anyone can read quotes through RLS, while insert/update/delete are limited to authenticated users.

The admin editor lives at:

```text
https://avollrath.github.io/supernote-quote/#/admin
```

Create only trusted admin users in Supabase Auth. Every authenticated user can edit and delete quotes under the included schema.

## Supabase Setup

1. Create a Supabase project.
2. Run [supabase/schema.sql](supabase/schema.sql) in the Supabase SQL editor.
3. Create one trusted admin user in Supabase Auth.
4. Add GitHub repository secrets for the Pages workflow:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. For local development, create `.env.local`:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

6. Import the existing static quote data:

```bash
SUPABASE_URL=your-project-url SUPABASE_SERVICE_ROLE_KEY=your-service-role-key npm run import:quotes
```

Never commit the service role key. It bypasses RLS and is only for trusted server-side scripts such as the one-time import.

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

## Commands

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Parse the Supernote export:

```bash
npm run parse:quotes
```

Import quotes into Supabase:

```bash
npm run import:quotes
```

Build:

```bash
npm run build
```

## Deployment

The GitHub Actions workflow at [.github/workflows/deploy.yml](.github/workflows/deploy.yml) runs on pushes to `main`, installs dependencies with `npm ci`, builds the Vite app, and deploys `dist` to GitHub Pages.

Vite is configured with `base: "/supernote-quote/"`, and routing is hash-based so the admin screen works on static hosting.

## Project Structure

- [src/App.tsx](src/App.tsx): public quote display, hash routing, Supabase-authenticated admin UI
- [src/App.css](src/App.css): public screen and admin styling
- [src/supabase.ts](src/supabase.ts): Supabase client setup
- [src/quotes-service.ts](src/quotes-service.ts): typed Supabase quote reads/writes
- [src/quotes-api.ts](src/quotes-api.ts): public quote loader with static fallback
- [supabase/schema.sql](supabase/schema.sql): production database schema and RLS policies
- [scripts/import-quotes-to-supabase.ts](scripts/import-quotes-to-supabase.ts): service-role import script
- [src/images/background.jpg](src/images/background.jpg): full-screen background image
- [data/raw/Documents.txt](data/raw/Documents.txt): preserved raw highlights export
- [src/data/quotes.json](src/data/quotes.json): structured fallback quote data
