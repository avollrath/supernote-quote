import { useCallback, useEffect, useMemo, useState } from 'react'
import { deleteQuote, fallbackQuotes, loadQuotes, updateQuote } from './quotes-api'
import type { Quote, QuoteUpdate } from './types'
import './App.css'

const CURRENT_QUOTE_KEY = 'supernote-quote-current-id'
const LEGACY_LANGUAGE_KEY = 'supernote-quote-language'
const isAdminRoute = window.location.pathname === '/admin'

function pickRandomQuote(availableQuotes: Quote[], currentId?: string) {
  if (availableQuotes.length === 0) {
    return undefined
  }

  const candidates =
    availableQuotes.length > 1 ? availableQuotes.filter((quote) => quote.id !== currentId) : availableQuotes
  const index = Math.floor(Math.random() * candidates.length)
  return candidates[index]
}

function getEnglishQuotes(quotes: Quote[]) {
  return quotes.filter((quote) => quote.language === 'en')
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
  onUpdateQuote: (id: string, update: QuoteUpdate) => Promise<void>
  onDeleteQuote: (id: string) => Promise<void>
}

function AdminPage({ quotes, isLoading, error, onUpdateQuote, onDeleteQuote }: AdminPageProps) {
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
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Local quote management</p>
          <h1>Supernote Quote Admin</h1>
        </div>
        <a href="/" className="admin-public-link">
          Public screen
        </a>
      </header>

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
      {error ? <p className="admin-error">{error}</p> : null}
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
    </main>
  )
}

function App() {
  const [quotes, setQuotes] = useState<Quote[]>(fallbackQuotes)
  const [currentQuoteId, setCurrentQuoteId] = useState<string | undefined>(() => readInitialQuoteId(fallbackQuotes))
  const [history, setHistory] = useState<string[]>([])
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(true)
  const [quotesError, setQuotesError] = useState('')

  const englishQuotes = useMemo(() => getEnglishQuotes(quotes), [quotes])

  const currentQuote = useMemo(() => {
    return englishQuotes.find((quote) => quote.id === currentQuoteId)
  }, [currentQuoteId, englishQuotes])

  const currentIndex = currentQuote ? englishQuotes.findIndex((quote) => quote.id === currentQuote.id) : -1
  const quoteLengthClass = currentQuote
    ? currentQuote.text.length > 620
      ? 'quote-text quote-text-long'
      : currentQuote.text.length > 320
        ? 'quote-text quote-text-medium'
        : 'quote-text'
    : 'quote-text'

  useEffect(() => {
    window.localStorage.removeItem(LEGACY_LANGUAGE_KEY)
  }, [])

  useEffect(() => {
    let cancelled = false

    loadQuotes()
      .then((loadedQuotes) => {
        if (cancelled) {
          return
        }

        const nextEnglishQuotes = getEnglishQuotes(loadedQuotes)
        setQuotes(loadedQuotes)
        setCurrentQuoteId((previousQuoteId) => {
          const currentStillExists = previousQuoteId
            ? nextEnglishQuotes.some((quote) => quote.id === previousQuoteId)
            : false

          return currentStillExists ? previousQuoteId : pickRandomQuote(nextEnglishQuotes)?.id
        })
        setHistory([])
      })
      .catch((error) => {
        if (!cancelled) {
          setQuotesError(error instanceof Error ? error.message : 'Unable to load quotes.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingQuotes(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleUpdateQuote = useCallback(async (id: string, update: QuoteUpdate) => {
    const updatedQuote = await updateQuote(id, update)
    setQuotes((currentQuotes) => currentQuotes.map((quote) => (quote.id === id ? updatedQuote : quote)))
  }, [])

  const handleDeleteQuote = useCallback(
    async (id: string) => {
      await deleteQuote(id)
      setQuotes((currentQuotes) => currentQuotes.filter((quote) => quote.id !== id))
      setHistory((currentHistory) => currentHistory.filter((quoteId) => quoteId !== id))

      if (currentQuoteId === id) {
        const nextEnglishQuotes = englishQuotes.filter((quote) => quote.id !== id)
        setCurrentQuoteId(pickRandomQuote(nextEnglishQuotes)?.id)
      }
    },
    [currentQuoteId, englishQuotes],
  )

  useEffect(() => {
    if (currentQuoteId) {
      window.localStorage.setItem(CURRENT_QUOTE_KEY, currentQuoteId)
    } else {
      window.localStorage.removeItem(CURRENT_QUOTE_KEY)
    }
  }, [currentQuoteId])

  const showNextQuote = useCallback(() => {
    const nextQuote = pickRandomQuote(englishQuotes, currentQuote?.id)

    if (!nextQuote) {
      return
    }

    setHistory((previousHistory) => (currentQuote ? [...previousHistory, currentQuote.id] : previousHistory))
    setCurrentQuoteId(nextQuote.id)
  }, [currentQuote, englishQuotes])

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

  if (isAdminRoute) {
    return (
      <AdminPage
        quotes={quotes}
        isLoading={isLoadingQuotes}
        error={quotesError}
        onUpdateQuote={handleUpdateQuote}
        onDeleteQuote={handleDeleteQuote}
      />
    )
  }

  return (
    <main className="quote-app">
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
            <p className={quoteLengthClass}>{currentQuote.text}</p>
            <p className="quote-source">
              {currentQuote.bookTitle}
              {currentQuote.author ? <span> - {currentQuote.author}</span> : null}
            </p>
            <p className="quote-counter">
              {currentIndex + 1} / {englishQuotes.length}
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
    </main>
  )
}

export default App
