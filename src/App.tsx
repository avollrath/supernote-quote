import { useCallback, useEffect, useMemo, useState } from 'react'
import quotesData from './data/quotes.json'
import './App.css'

type Language = 'all' | 'en' | 'de'

type Quote = {
  id: string
  text: string
  bookTitle: string
  author: string
  language: 'en' | 'de'
  sourceFile: string
}

const quotes = quotesData as Quote[]
const languageOptions: Array<{ value: Language; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
]

const LANGUAGE_KEY = 'supernote-quote-language'
const CURRENT_QUOTE_KEY = 'supernote-quote-current-id'

function readStoredLanguage(): Language {
  const stored = window.localStorage.getItem(LANGUAGE_KEY)
  return stored === 'en' || stored === 'de' || stored === 'all' ? stored : 'all'
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

function App() {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(() => readStoredLanguage())
  const [currentQuoteId, setCurrentQuoteId] = useState<string | undefined>(() => {
    return window.localStorage.getItem(CURRENT_QUOTE_KEY) ?? undefined
  })
  const [history, setHistory] = useState<string[]>([])

  const filteredQuotes = useMemo(() => {
    if (selectedLanguage === 'all') {
      return quotes
    }

    return quotes.filter((quote) => quote.language === selectedLanguage)
  }, [selectedLanguage])

  const currentQuote = useMemo(() => {
    return filteredQuotes.find((quote) => quote.id === currentQuoteId)
  }, [currentQuoteId, filteredQuotes])

  const currentIndex = currentQuote ? filteredQuotes.findIndex((quote) => quote.id === currentQuote.id) : -1
  const quoteLengthClass = currentQuote
    ? currentQuote.text.length > 700
      ? 'quote-text quote-text-long'
      : currentQuote.text.length > 360
        ? 'quote-text quote-text-medium'
        : 'quote-text'
    : 'quote-text'

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_KEY, selectedLanguage)
  }, [selectedLanguage])

  useEffect(() => {
    if (currentQuoteId) {
      window.localStorage.setItem(CURRENT_QUOTE_KEY, currentQuoteId)
    } else {
      window.localStorage.removeItem(CURRENT_QUOTE_KEY)
    }
  }, [currentQuoteId])

  useEffect(() => {
    if (filteredQuotes.length === 0) {
      setCurrentQuoteId(undefined)
      setHistory([])
      return
    }

    if (!currentQuote) {
      setCurrentQuoteId(pickRandomQuote(filteredQuotes)?.id)
      setHistory([])
    }
  }, [currentQuote, filteredQuotes])

  const showNextQuote = useCallback(() => {
    const nextQuote = pickRandomQuote(filteredQuotes, currentQuote?.id)

    if (!nextQuote) {
      return
    }

    setHistory((previousHistory) => (currentQuote ? [...previousHistory, currentQuote.id] : previousHistory))
    setCurrentQuoteId(nextQuote.id)
  }, [currentQuote, filteredQuotes])

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
      <header className="app-header">
        <div className="language-select" aria-label="Quote language">
          {languageOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === selectedLanguage ? 'language-option language-option-active' : 'language-option'}
              onClick={() => setSelectedLanguage(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <button
        className="nav-button nav-button-previous"
        type="button"
        onClick={showPreviousQuote}
        disabled={!history.length}
        aria-label="Previous quote"
      >
        ‹
      </button>

      <section className="quote-stage" aria-live="polite">
        {currentQuote ? (
          <>
            <p className={quoteLengthClass}>{currentQuote.text}</p>
            <p className="quote-source">
              {currentQuote.bookTitle}
              {currentQuote.author ? <span> · {currentQuote.author}</span> : null}
            </p>
            <p className="quote-counter">
              {currentIndex + 1} / {filteredQuotes.length}
            </p>
          </>
        ) : (
          <p className="empty-state">No quotes available.</p>
        )}
      </section>

      <button
        className="nav-button nav-button-next"
        type="button"
        onClick={showNextQuote}
        disabled={!filteredQuotes.length}
        aria-label="Next quote"
      >
        ›
      </button>
    </main>
  )
}

export default App
