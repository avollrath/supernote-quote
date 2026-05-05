import { useCallback, useEffect, useMemo, useState } from 'react'
import quotesData from './data/quotes.json'
import './App.css'

type Quote = {
  id: string
  text: string
  bookTitle: string
  author: string
  language: 'en' | 'de'
  sourceFile: string
}

const quotes = quotesData as Quote[]
const englishQuotes = quotes.filter((quote) => quote.language === 'en')
const CURRENT_QUOTE_KEY = 'supernote-quote-current-id'
const LEGACY_LANGUAGE_KEY = 'supernote-quote-language'

function pickRandomQuote(availableQuotes: Quote[], currentId?: string) {
  if (availableQuotes.length === 0) {
    return undefined
  }

  const candidates =
    availableQuotes.length > 1 ? availableQuotes.filter((quote) => quote.id !== currentId) : availableQuotes
  const index = Math.floor(Math.random() * candidates.length)
  return candidates[index]
}

function readInitialQuoteId() {
  const storedQuoteId = window.localStorage.getItem(CURRENT_QUOTE_KEY) ?? undefined

  if (storedQuoteId && englishQuotes.some((quote) => quote.id === storedQuoteId)) {
    return storedQuoteId
  }

  return pickRandomQuote(englishQuotes)?.id
}

function App() {
  const [currentQuoteId, setCurrentQuoteId] = useState<string | undefined>(() => readInitialQuoteId())
  const [history, setHistory] = useState<string[]>([])

  const currentQuote = useMemo(() => {
    return englishQuotes.find((quote) => quote.id === currentQuoteId)
  }, [currentQuoteId])

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
  }, [currentQuote])

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
