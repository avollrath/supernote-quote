import { useCallback, useEffect, useMemo, useState } from 'react'
import { deleteQuote, fallbackQuotes, loadAdminQuotes, updateQuote } from './quotes-api'
import type { Quote, QuoteUpdate } from './types'
import backgroundImageUrl from './images/background.jpg'
import './App.css'

const CURRENT_QUOTE_KEY = 'sententia-current-id'
const LEGACY_LANGUAGE_KEY = 'sententia-language'
const DISPLAY_QUOTE_MAX_LENGTH_KEY = 'sententia-display-quote-max-length'
const MIN_DISPLAY_QUOTE_LENGTH = 60
const MAX_DISPLAY_QUOTE_LENGTH = 1000
const UNLIMITED_DISPLAY_QUOTE_LENGTH = MAX_DISPLAY_QUOTE_LENGTH + 1

function getRouteFromHash() {
  return window.location.hash.replace(/^#/, '') || '/'
}

function pickRandomQuote(availableQuotes: Quote[], currentId?: string) {
  if (availableQuotes.length === 0) {
    return undefined
  }

  const candidates =
    availableQuotes.length > 1 ? availableQuotes.filter((quote) => quote.id !== currentId) : availableQuotes
  const index = Math.floor(Math.random() * candidates.length)
  return candidates[index]
}

function AppBackground() {
  return (
    <>
      <img className="app-background" src={backgroundImageUrl} alt="" aria-hidden="true" />
      <div className="app-background-overlay" aria-hidden="true" />
    </>
  )
}

function getEnglishQuotes(quotes: Quote[]) {
  return quotes.filter((quote) => quote.language === 'en')
}

function isUnlimitedDisplayQuoteLength(value: number) {
  return value >= UNLIMITED_DISPLAY_QUOTE_LENGTH
}

function readInitialDisplayQuoteMaxLength() {
  const storedValue = Number(window.localStorage.getItem(DISPLAY_QUOTE_MAX_LENGTH_KEY))

  if (Number.isFinite(storedValue)) {
    return Math.min(
      UNLIMITED_DISPLAY_QUOTE_LENGTH,
      Math.max(MIN_DISPLAY_QUOTE_LENGTH, Math.round(storedValue)),
    )
  }

  return UNLIMITED_DISPLAY_QUOTE_LENGTH
}

function truncateQuoteForDisplay(text: string, maxLength: number) {
  if (isUnlimitedDisplayQuoteLength(maxLength) || text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength - 1).trim()}…`
}

function formatQuoteForDisplay(text: string, maxLength: number) {
  const spacedText = truncateQuoteForDisplay(text.replace(/([,.:])(?=\S)/g, '$1 '), maxLength)
  const trimmedText = spacedText.trim()
  const hasOpeningQuote = /^[“"‘'«„]/.test(trimmedText)
  const hasClosingQuote = /[”"’'»][.!?…]*$/.test(trimmedText)

  if (hasOpeningQuote && hasClosingQuote) {
    return spacedText
  }

  const openingQuote = hasOpeningQuote ? '' : '“'
  const closingQuote = hasClosingQuote ? '' : '”'
  return `${openingQuote}${spacedText}${closingQuote}`
}

function readInitialQuoteId(quotes: Quote[]) {
  const englishQuotes = getEnglishQuotes(quotes)
  const storedQuoteId = window.localStorage.getItem(CURRENT_QUOTE_KEY) ?? undefined

  if (storedQuoteId && englishQuotes.some((quote) => quote.id === storedQuoteId)) {
    return storedQuoteId
  }

  return pickRandomQuote(englishQuotes)?.id
}

type AdminPageProps = {
  quotes: Quote[]
  isLoading: boolean
  error: string
  displayQuoteMaxLength: number
  onReload: () => Promise<void>
  onUpdateQuote: (id: string, update: QuoteUpdate) => Promise<void>
  onDeleteQuote: (id: string) => Promise<void>
  onDisplayQuoteMaxLengthChange: (value: number) => void
}

function AdminPage({
  quotes,
  isLoading,
  error,
  displayQuoteMaxLength,
  onReload,
  onUpdateQuote,
  onDeleteQuote,
  onDisplayQuoteMaxLengthChange,
}: AdminPageProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState<string | undefined>()
  const [draft, setDraft] = useState<QuoteUpdate>({ text: '', bookTitle: '', author: '' })
  const [saveError, setSaveError] = useState('')

  const filteredQuotes = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    if (!normalizedSearch) {
      return quotes
    }

    return quotes.filter((quote) => {
      return [quote.text, quote.bookTitle, quote.author].some((value) => value.toLowerCase().includes(normalizedSearch))
    })
  }, [quotes, searchTerm])

  function startEditing(quote: Quote) {
    setEditingId(quote.id)
    setDraft({
      text: quote.text,
      bookTitle: quote.bookTitle,
      author: quote.author,
    })
    setSaveError('')
  }

  function cancelEditing() {
    setEditingId(undefined)
    setDraft({ text: '', bookTitle: '', author: '' })
    setSaveError('')
  }

  async function saveQuote(id: string) {
    setSaveError('')

    try {
      await onUpdateQuote(id, draft)
      cancelEditing()
    } catch (saveError) {
      setSaveError(saveError instanceof Error ? saveError.message : 'Unable to save quote.')
    }
  }

  async function deleteSelectedQuote(quote: Quote) {
    const confirmed = window.confirm(`Delete this quote from ${quote.bookTitle}?`)

    if (!confirmed) {
      return
    }

    setSaveError('')

    try {
      await onDeleteQuote(quote.id)
      if (editingId === quote.id) {
        cancelEditing()
      }
    } catch (deleteError) {
      setSaveError(deleteError instanceof Error ? deleteError.message : 'Unable to delete quote.')
    }
  }

  return (
    <main className="admin-app">
      <AppBackground />
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Local JSON quote management</p>
          <h1>Sententia Admin</h1>
        </div>
        <a href="#/" className="admin-public-link">
          Public screen
        </a>
      </header>

      <section className="admin-settings">
        <div>
          <p className="admin-setting-title">Displayed quote length</p>
          <p className="admin-setting-help">Limit public quote text in this browser.</p>
        </div>
        <label className="admin-range-setting">
          <span>
            {isUnlimitedDisplayQuoteLength(displayQuoteMaxLength)
              ? 'Unlimited'
              : `${displayQuoteMaxLength} characters`}
          </span>
          <input
            type="range"
            min={MIN_DISPLAY_QUOTE_LENGTH}
            max={UNLIMITED_DISPLAY_QUOTE_LENGTH}
            step="1"
            value={displayQuoteMaxLength}
            aria-valuetext={
              isUnlimitedDisplayQuoteLength(displayQuoteMaxLength)
                ? 'Unlimited'
                : `${displayQuoteMaxLength} characters`
            }
            onChange={(event) => onDisplayQuoteMaxLengthChange(Number(event.target.value))}
          />
        </label>
      </section>

      {error ? (
        <section className="admin-local-warning">
          <p>Admin editing is only available locally. Run npm run dev:full.</p>
          <button type="button" onClick={onReload}>
            Try again
          </button>
        </section>
      ) : null}

      {!error ? (
        <>
          <section className="admin-toolbar">
            <label className="admin-search">
              <span>Search quotes</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search text, title, or author"
              />
            </label>
            <p className="admin-count">
              {filteredQuotes.length} / {quotes.length} quotes
            </p>
          </section>

          {isLoading ? <p className="admin-state">Loading quotes...</p> : null}
          {saveError ? <p className="admin-error">{saveError}</p> : null}
          {!isLoading && filteredQuotes.length === 0 ? <p className="admin-state">No quotes match that search.</p> : null}

          <section className="admin-list">
            {filteredQuotes.map((quote) => {
              const isEditing = editingId === quote.id

              return (
                <article className="quote-admin-item" key={quote.id}>
                  {isEditing ? (
                    <div className="quote-editor">
                      <label>
                        <span>Quote text</span>
                        <textarea
                          value={draft.text}
                          onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))}
                          rows={6}
                        />
                      </label>
                      <label>
                        <span>Book title</span>
                        <input
                          value={draft.bookTitle}
                          onChange={(event) => setDraft((current) => ({ ...current, bookTitle: event.target.value }))}
                        />
                      </label>
                      <label>
                        <span>Author</span>
                        <input
                          value={draft.author}
                          onChange={(event) => setDraft((current) => ({ ...current, author: event.target.value }))}
                        />
                      </label>
                      <div className="admin-actions">
                        <button type="button" onClick={() => saveQuote(quote.id)}>
                          Save
                        </button>
                        <button type="button" onClick={cancelEditing}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="admin-quote-text">{quote.text}</p>
                      <p className="admin-quote-source">
                        {quote.bookTitle}
                        {quote.author ? <span> - {quote.author}</span> : null}
                      </p>
                      <p className="admin-language">{quote.language}</p>
                      <div className="admin-actions">
                        <button type="button" onClick={() => startEditing(quote)}>
                          Edit
                        </button>
                        <button type="button" className="danger-button" onClick={() => deleteSelectedQuote(quote)}>
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </article>
              )
            })}
          </section>
        </>
      ) : null}
    </main>
  )
}

function App() {
  const [route, setRoute] = useState(() => getRouteFromHash())
  const [quotes] = useState<Quote[]>(fallbackQuotes)
  const [adminQuotes, setAdminQuotes] = useState<Quote[]>([])
  const [currentQuoteId, setCurrentQuoteId] = useState<string | undefined>(() => readInitialQuoteId(fallbackQuotes))
  const [history, setHistory] = useState<string[]>([])
  const [seenQuoteIds, setSeenQuoteIds] = useState<Set<string>>(() => new Set())
  const [displayQuoteMaxLength, setDisplayQuoteMaxLength] = useState(readInitialDisplayQuoteMaxLength)
  const [isLoadingAdminQuotes, setIsLoadingAdminQuotes] = useState(false)
  const [adminError, setAdminError] = useState('')

  const englishQuotes = useMemo(() => getEnglishQuotes(quotes), [quotes])

  const currentQuote = useMemo(() => {
    return englishQuotes.find((quote) => quote.id === currentQuoteId)
  }, [currentQuoteId, englishQuotes])

  const quoteLengthClass = currentQuote
    ? currentQuote.text.length > 620
      ? 'quote-text quote-text-long'
      : currentQuote.text.length > 320
        ? 'quote-text quote-text-medium'
        : 'quote-text'
    : 'quote-text'

  useEffect(() => {
    function handleHashChange() {
      setRoute(getRouteFromHash())
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    window.localStorage.removeItem(LEGACY_LANGUAGE_KEY)
  }, [])

  useEffect(() => {
    if (currentQuoteId) {
      window.localStorage.setItem(CURRENT_QUOTE_KEY, currentQuoteId)
    } else {
      window.localStorage.removeItem(CURRENT_QUOTE_KEY)
    }
  }, [currentQuoteId])

  useEffect(() => {
    window.localStorage.setItem(DISPLAY_QUOTE_MAX_LENGTH_KEY, String(displayQuoteMaxLength))
  }, [displayQuoteMaxLength])

  const reloadAdminQuotes = useCallback(async () => {
    setIsLoadingAdminQuotes(true)
    setAdminError('')

    try {
      setAdminQuotes(await loadAdminQuotes())
    } catch {
      setAdminQuotes([])
      setAdminError('Admin editing is only available locally. Run npm run dev:full.')
    } finally {
      setIsLoadingAdminQuotes(false)
    }
  }, [])

  useEffect(() => {
    if (route === '/admin') {
      void Promise.resolve().then(() => reloadAdminQuotes())
    }
  }, [reloadAdminQuotes, route])

  const handleUpdateQuote = useCallback(async (id: string, update: QuoteUpdate) => {
    const updatedQuote = await updateQuote(id, update)
    setAdminQuotes((currentQuotes) => currentQuotes.map((quote) => (quote.id === id ? updatedQuote : quote)))
  }, [])

  const handleDeleteQuote = useCallback(async (id: string) => {
    await deleteQuote(id)
    setAdminQuotes((currentQuotes) => currentQuotes.filter((quote) => quote.id !== id))
  }, [])

  const showNextQuote = useCallback(() => {
    const seenIds = new Set(seenQuoteIds)

    if (currentQuote) {
      seenIds.add(currentQuote.id)
    }

    let candidates = englishQuotes.filter((quote) => !seenIds.has(quote.id))

    if (candidates.length === 0) {
      seenIds.clear()

      if (currentQuote) {
        seenIds.add(currentQuote.id)
      }

      candidates = englishQuotes.filter((quote) => quote.id !== currentQuote?.id)
    }

    const nextQuote = pickRandomQuote(candidates, currentQuote?.id)

    if (!nextQuote) {
      return
    }

    setHistory((previousHistory) => (currentQuote ? [...previousHistory, currentQuote.id] : previousHistory))
    setCurrentQuoteId(nextQuote.id)
    setSeenQuoteIds(new Set([...seenIds, nextQuote.id]))
  }, [currentQuote, englishQuotes, seenQuoteIds])

  const showPreviousQuote = useCallback(() => {
    setHistory((previousHistory) => {
      const previousQuoteId = previousHistory.at(-1)

      if (!previousQuoteId) {
        return previousHistory
      }

      setCurrentQuoteId(previousQuoteId)
      return previousHistory.slice(0, -1)
    })
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement

      if (isTyping) {
        return
      }

      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault()
        showNextQuote()
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        showPreviousQuote()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showNextQuote, showPreviousQuote])

  if (route === '/admin') {
    return (
      <AdminPage
        quotes={adminQuotes}
        isLoading={isLoadingAdminQuotes}
        error={adminError}
        displayQuoteMaxLength={displayQuoteMaxLength}
        onReload={reloadAdminQuotes}
        onUpdateQuote={handleUpdateQuote}
        onDeleteQuote={handleDeleteQuote}
        onDisplayQuoteMaxLengthChange={setDisplayQuoteMaxLength}
      />
    )
  }

  return (
    <main className="quote-app">
      <AppBackground />
      <button
        className="nav-button nav-button-previous"
        type="button"
        onClick={showPreviousQuote}
        disabled={!history.length}
        aria-label="Previous quote"
      >
        {'<'}
      </button>

      <section className="quote-stage" aria-live="polite">
        {currentQuote ? (
          <>
            <p className={quoteLengthClass}>{formatQuoteForDisplay(currentQuote.text, displayQuoteMaxLength)}</p>
            <p className="quote-source">
              {currentQuote.bookTitle}
              {currentQuote.author ? <span> - {currentQuote.author}</span> : null}
            </p>
          </>
        ) : (
          <p className="empty-state">No English quotes available.</p>
        )}
      </section>

      <button
        className="nav-button nav-button-next"
        type="button"
        onClick={showNextQuote}
        disabled={!englishQuotes.length}
        aria-label="Next quote"
      >
        {'>'}
      </button>

      <footer className="site-footer">
        Sententia by{' '}
        <a href="https://vollrath.dev/" target="_blank" rel="noreferrer">
          vollrath.dev
        </a>
      </footer>
    </main>
  )
}

export default App
