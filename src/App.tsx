import { useCallback, useEffect, useMemo, useState } from 'react'
import { deleteQuote, fallbackQuotes, loadQuotesWithFallback, updateQuote } from './quotes-api'
import { fetchSupabaseQuotes } from './quotes-service'
import { isSupabaseConfigured, supabase } from './supabase'
import type { Quote, QuoteUpdate } from './types'
import type { Session } from '@supabase/supabase-js'
import backgroundImageUrl from './images/background.jpg'
import './App.css'

const CURRENT_QUOTE_KEY = 'supernote-quote-current-id'
const LEGACY_LANGUAGE_KEY = 'supernote-quote-language'
const backgroundStyle = {
  '--background-image-url': `url(${backgroundImageUrl})`,
} as React.CSSProperties

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
  session: Session | null
  isAuthLoading: boolean
  onSignIn: (email: string, password: string) => Promise<void>
  onSignOut: () => Promise<void>
  onUpdateQuote: (id: string, update: QuoteUpdate) => Promise<void>
  onDeleteQuote: (id: string) => Promise<void>
}

function AdminPage({
  quotes,
  isLoading,
  error,
  session,
  isAuthLoading,
  onSignIn,
  onSignOut,
  onUpdateQuote,
  onDeleteQuote,
}: AdminPageProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [editingId, setEditingId] = useState<string | undefined>()
  const [draft, setDraft] = useState<QuoteUpdate>({ text: '', bookTitle: '', author: '' })
  const [saveError, setSaveError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

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

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveError('')

    try {
      await onSignIn(email, password)
      setPassword('')
    } catch (loginError) {
      setSaveError(loginError instanceof Error ? loginError.message : 'Unable to sign in.')
    }
  }

  return (
    <main className="admin-app" style={backgroundStyle}>
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Supabase quote management</p>
          <h1>Supernote Quote Admin</h1>
        </div>
        <a href="#/" className="admin-public-link">
          Public screen
        </a>
      </header>

      {!isSupabaseConfigured ? (
        <p className="admin-error">Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</p>
      ) : null}

      {isAuthLoading ? <p className="admin-state">Checking session...</p> : null}

      {!isAuthLoading && !session ? (
        <form className="admin-login" onSubmit={submitLogin}>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" disabled={!isSupabaseConfigured}>
            Sign in
          </button>
          {saveError ? <p className="admin-error">{saveError}</p> : null}
        </form>
      ) : null}

      {session ? (
        <section className="admin-session">
          <span>{session.user.email}</span>
          <button type="button" onClick={onSignOut}>
            Sign out
          </button>
        </section>
      ) : null}

      {session ? (
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
      ) : null}

      {session && isLoading ? <p className="admin-state">Loading quotes...</p> : null}
      {session && error ? <p className="admin-error">{error}</p> : null}
      {session && saveError ? <p className="admin-error">{saveError}</p> : null}
      {session && !isLoading && filteredQuotes.length === 0 ? (
        <p className="admin-state">No quotes match that search.</p>
      ) : null}

      {session ? <section className="admin-list">
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
      </section> : null}
    </main>
  )
}

function App() {
  const [route, setRoute] = useState(() => getRouteFromHash())
  const [quotes, setQuotes] = useState<Quote[]>(fallbackQuotes)
  const [currentQuoteId, setCurrentQuoteId] = useState<string | undefined>(() => readInitialQuoteId(fallbackQuotes))
  const [history, setHistory] = useState<string[]>([])
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(true)
  const [quotesError, setQuotesError] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(isSupabaseConfigured)

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
    function handleHashChange() {
      setRoute(getRouteFromHash())
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    if (!supabase) {
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsAuthLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (route !== '/admin' || !session) {
      return
    }

    let cancelled = false

    Promise.resolve()
      .then(() => {
        if (!cancelled) {
          setIsLoadingQuotes(true)
          setQuotesError('')
        }

        return fetchSupabaseQuotes()
      })
      .then((loadedQuotes) => {
        if (!cancelled) {
          setQuotes(loadedQuotes)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setQuotesError(error instanceof Error ? error.message : 'Unable to load quotes from Supabase.')
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
  }, [route, session])

  const handleSignIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      throw new Error('Supabase is not configured.')
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      throw error
    }
  }, [])

  const handleSignOut = useCallback(async () => {
    if (!supabase) {
      return
    }

    const { error } = await supabase.auth.signOut()

    if (error) {
      throw error
    }
  }, [])

  useEffect(() => {
    window.localStorage.removeItem(LEGACY_LANGUAGE_KEY)
  }, [])

  useEffect(() => {
    let cancelled = false

    loadQuotesWithFallback()
      .then((result) => {
        if (cancelled) {
          return
        }

        const loadedQuotes = result.quotes
        const nextEnglishQuotes = getEnglishQuotes(loadedQuotes)
        setQuotes(loadedQuotes)
        setCurrentQuoteId((previousQuoteId) => {
          const currentStillExists = previousQuoteId
            ? nextEnglishQuotes.some((quote) => quote.id === previousQuoteId)
            : false

          return currentStillExists ? previousQuoteId : pickRandomQuote(nextEnglishQuotes)?.id
        })
        setHistory([])
        setQuotesError(result.didFallback ? `Using static fallback because /api/quotes is unavailable: ${result.error}` : '')
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

  if (route === '/admin') {
    return (
      <AdminPage
        quotes={quotes}
        isLoading={isLoadingQuotes}
        error={quotesError}
        session={session}
        isAuthLoading={isAuthLoading}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onUpdateQuote={handleUpdateQuote}
        onDeleteQuote={handleDeleteQuote}
      />
    )
  }

  return (
    <main className="quote-app" style={backgroundStyle}>
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
