import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  deleteQuote,
  fallbackConfig,
  fallbackQuotes,
  loadAdminConfig,
  loadAdminQuotes,
  updateConfig,
  updateQuote,
} from './quotes-api'
import type { AppConfig, Quote, QuoteUpdate } from './types'
import backgroundImageUrl from './images/background.jpg'
import './App.css'

const CURRENT_QUOTE_KEY = 'sententia-current-id'
const LEGACY_LANGUAGE_KEY = 'sententia-language'
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

function getDisplayableQuotes(quotes: Quote[], config: AppConfig) {
  const englishQuotes = getEnglishQuotes(quotes)
  const maxLength = config.displayQuoteMaxLength

  if (maxLength === null) {
    return englishQuotes
  }

  return englishQuotes.filter((quote) => quote.text.length <= maxLength)
}

function isUnlimitedDisplayQuoteLength(value: number) {
  return value >= UNLIMITED_DISPLAY_QUOTE_LENGTH
}

function configToSliderValue(config: AppConfig) {
  return config.displayQuoteMaxLength ?? UNLIMITED_DISPLAY_QUOTE_LENGTH
}

function sliderValueToConfig(value: number): AppConfig {
  if (isUnlimitedDisplayQuoteLength(value)) {
    return { displayQuoteMaxLength: null }
  }

  return {
    displayQuoteMaxLength: Math.min(MAX_DISPLAY_QUOTE_LENGTH, Math.max(MIN_DISPLAY_QUOTE_LENGTH, Math.round(value))),
  }
}

function isQuoteVisibleByConfig(quote: Quote, config: AppConfig) {
  return quote.language === 'en' && (config.displayQuoteMaxLength === null || quote.text.length <= config.displayQuoteMaxLength)
}

function formatQuoteForDisplay(text: string) {
  const spacedText = text.replace(/([,.:])(?=\S)/g, '$1 ')
  const displayText = spacedText
    .trim()
    .replace(/\s+([\u201d"\u2019'\u00bb])([.!?\u2026]*)$/u, '$1$2')
    .replace(/([\u201d"\u2019'\u00bb])[.!?\u2026]+$/u, '$1')
  const hasOpeningQuote = /^[\u201c"\u2018'\u00ab\u201e]/u.test(displayText)
  const hasClosingQuote = /[\u201d"\u2019'\u00bb]$/u.test(displayText)

  if (hasOpeningQuote && hasClosingQuote) {
    return displayText
  }

  const openingQuote = hasOpeningQuote ? '' : '\u201c'
  const closingQuote = hasClosingQuote ? '' : '\u201d'
  return `${openingQuote}${displayText}${closingQuote}`
}

function readInitialQuoteId(quotes: Quote[]) {
  const englishQuotes = getDisplayableQuotes(quotes, fallbackConfig)
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
  config: AppConfig
  onReload: () => Promise<void>
  onUpdateQuote: (id: string, update: QuoteUpdate) => Promise<void>
  onDeleteQuote: (id: string) => Promise<void>
  onConfigChange: (config: AppConfig) => Promise<void>
}

function AdminPage({
  quotes,
  isLoading,
  error,
  config,
  onReload,
  onUpdateQuote,
  onDeleteQuote,
  onConfigChange,
}: AdminPageProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'displayed' | 'filtered'>('all')
  const [editingId, setEditingId] = useState<string | undefined>()
  const [draft, setDraft] = useState<QuoteUpdate>({ text: '', bookTitle: '', author: '' })
  const [displayQuoteMaxLengthDraft, setDisplayQuoteMaxLengthDraft] = useState(() => configToSliderValue(config))
  const [saveError, setSaveError] = useState('')
  const savedDisplayQuoteMaxLength = configToSliderValue(config)
  const hasUnsavedDisplaySetting = displayQuoteMaxLengthDraft !== savedDisplayQuoteMaxLength
  const englishQuoteCount = useMemo(() => getEnglishQuotes(quotes).length, [quotes])
  const draftDisplayableQuoteCount = useMemo(
    () => getDisplayableQuotes(quotes, sliderValueToConfig(displayQuoteMaxLengthDraft)).length,
    [displayQuoteMaxLengthDraft, quotes],
  )
  const draftConfig = useMemo(() => sliderValueToConfig(displayQuoteMaxLengthDraft), [displayQuoteMaxLengthDraft])

  const filteredQuotes = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    const visibilityMatches = (quote: Quote) => {
      if (visibilityFilter === 'all') {
        return true
      }

      const isDisplayed = isQuoteVisibleByConfig(quote, draftConfig)
      return visibilityFilter === 'displayed' ? isDisplayed : !isDisplayed
    }

    const searchMatches = (quote: Quote) => {
      if (!normalizedSearch) {
        return true
      }

      return [quote.text, quote.bookTitle, quote.author].some((value) => value.toLowerCase().includes(normalizedSearch))
    }

    return quotes.filter((quote) => visibilityMatches(quote) && searchMatches(quote))
  }, [draftConfig, quotes, searchTerm, visibilityFilter])

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

  async function saveDisplayQuoteMaxLength() {
    setSaveError('')

    try {
      await onConfigChange(sliderValueToConfig(displayQuoteMaxLengthDraft))
    } catch (configError) {
      setSaveError(configError instanceof Error ? configError.message : 'Unable to save display settings.')
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
          <section className="admin-settings">
            <div>
              <p className="admin-setting-title">Displayed quote length</p>
              <p className="admin-setting-help">
                Public quotes longer than this are hidden. Commit config.json after changing it.
              </p>
              <p className="admin-setting-count">
                {draftDisplayableQuoteCount} / {englishQuoteCount} public quotes displayed
              </p>
            </div>
            <label className="admin-range-setting">
              <span>
                {isUnlimitedDisplayQuoteLength(displayQuoteMaxLengthDraft)
                  ? 'Unlimited'
                  : `${displayQuoteMaxLengthDraft} characters`}
              </span>
              <input
                type="range"
                min={MIN_DISPLAY_QUOTE_LENGTH}
                max={UNLIMITED_DISPLAY_QUOTE_LENGTH}
                step="1"
                value={displayQuoteMaxLengthDraft}
                aria-valuetext={
                  isUnlimitedDisplayQuoteLength(displayQuoteMaxLengthDraft)
                    ? 'Unlimited'
                    : `${displayQuoteMaxLengthDraft} characters`
                }
                onChange={(event) => setDisplayQuoteMaxLengthDraft(Number(event.target.value))}
              />
              <button type="button" disabled={!hasUnsavedDisplaySetting} onClick={() => void saveDisplayQuoteMaxLength()}>
                Save
              </button>
            </label>
          </section>

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
            <label className="admin-filter">
              <span>Show</span>
              <select
                value={visibilityFilter}
                onChange={(event) => setVisibilityFilter(event.target.value as typeof visibilityFilter)}
              >
                <option value="all">All</option>
                <option value="displayed">Displayed</option>
                <option value="filtered">Filtered out</option>
              </select>
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
  const [config, setConfig] = useState<AppConfig>(fallbackConfig)
  const [adminQuotes, setAdminQuotes] = useState<Quote[]>([])
  const [currentQuoteId, setCurrentQuoteId] = useState<string | undefined>(() => readInitialQuoteId(fallbackQuotes))
  const [history, setHistory] = useState<string[]>([])
  const [seenQuoteIds, setSeenQuoteIds] = useState<Set<string>>(() => new Set())
  const [isLoadingAdminQuotes, setIsLoadingAdminQuotes] = useState(false)
  const [adminError, setAdminError] = useState('')

  const displayableQuotes = useMemo(() => getDisplayableQuotes(quotes, config), [config, quotes])

  const currentQuote = useMemo(() => {
    return displayableQuotes.find((quote) => quote.id === currentQuoteId)
  }, [currentQuoteId, displayableQuotes])

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
    if (currentQuoteId && displayableQuotes.some((quote) => quote.id === currentQuoteId)) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setHistory([])
      setSeenQuoteIds(new Set())
      setCurrentQuoteId(pickRandomQuote(displayableQuotes)?.id)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [currentQuoteId, displayableQuotes])

  const reloadAdminData = useCallback(async () => {
    setIsLoadingAdminQuotes(true)
    setAdminError('')

    try {
      const [nextQuotes, nextConfig] = await Promise.all([loadAdminQuotes(), loadAdminConfig()])
      setAdminQuotes(nextQuotes)
      setConfig(nextConfig)
    } catch {
      setAdminQuotes([])
      setAdminError('Admin editing is only available locally. Run npm run dev:full.')
    } finally {
      setIsLoadingAdminQuotes(false)
    }
  }, [])

  useEffect(() => {
    if (route === '/admin') {
      void Promise.resolve().then(() => reloadAdminData())
    }
  }, [reloadAdminData, route])

  const handleUpdateQuote = useCallback(async (id: string, update: QuoteUpdate) => {
    const updatedQuote = await updateQuote(id, update)
    setAdminQuotes((currentQuotes) => currentQuotes.map((quote) => (quote.id === id ? updatedQuote : quote)))
  }, [])

  const handleDeleteQuote = useCallback(async (id: string) => {
    await deleteQuote(id)
    setAdminQuotes((currentQuotes) => currentQuotes.filter((quote) => quote.id !== id))
  }, [])

  const handleUpdateConfig = useCallback(async (nextConfig: AppConfig) => {
    setConfig(await updateConfig(nextConfig))
  }, [])

  const showNextQuote = useCallback(() => {
    const seenIds = new Set(seenQuoteIds)

    if (currentQuote) {
      seenIds.add(currentQuote.id)
    }

    let candidates = displayableQuotes.filter((quote) => !seenIds.has(quote.id))

    if (candidates.length === 0) {
      seenIds.clear()

      if (currentQuote) {
        seenIds.add(currentQuote.id)
      }

      candidates = displayableQuotes.filter((quote) => quote.id !== currentQuote?.id)
    }

    const nextQuote = pickRandomQuote(candidates, currentQuote?.id)

    if (!nextQuote) {
      return
    }

    setHistory((previousHistory) => (currentQuote ? [...previousHistory, currentQuote.id] : previousHistory))
    setCurrentQuoteId(nextQuote.id)
    setSeenQuoteIds(new Set([...seenIds, nextQuote.id]))
  }, [currentQuote, displayableQuotes, seenQuoteIds])

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
        key={configToSliderValue(config)}
        quotes={adminQuotes}
        isLoading={isLoadingAdminQuotes}
        error={adminError}
        config={config}
        onReload={reloadAdminData}
        onUpdateQuote={handleUpdateQuote}
        onDeleteQuote={handleDeleteQuote}
        onConfigChange={handleUpdateConfig}
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
            <p className={quoteLengthClass}>{formatQuoteForDisplay(currentQuote.text)}</p>
            <p className="quote-source">
              {currentQuote.bookTitle}
              {currentQuote.author ? <span> - {currentQuote.author}</span> : null}
            </p>
          </>
        ) : (
          <p className="empty-state">No quotes match the current display settings.</p>
        )}
      </section>

      <button
        className="nav-button nav-button-next"
        type="button"
        onClick={showNextQuote}
        disabled={!displayableQuotes.length}
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
