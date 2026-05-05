import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export type Quote = {
  id: string
  text: string
  bookTitle: string
  author: string
  language: 'en' | 'de'
  sourceFile: string
}

export type QuoteUpdate = {
  text?: string
  bookTitle?: string
  author?: string
}

const QUOTES_PATH = resolve('src/data/quotes.json')

function isQuote(value: unknown): value is Quote {
  if (!value || typeof value !== 'object') {
    return false
  }

  const quote = value as Record<string, unknown>
  return (
    typeof quote.id === 'string' &&
    typeof quote.text === 'string' &&
    typeof quote.bookTitle === 'string' &&
    typeof quote.author === 'string' &&
    (quote.language === 'en' || quote.language === 'de') &&
    typeof quote.sourceFile === 'string'
  )
}

export function validateQuoteUpdate(value: unknown): QuoteUpdate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Request body must be an object.')
  }

  const body = value as Record<string, unknown>
  const allowedFields = new Set(['text', 'bookTitle', 'author'])
  const unknownFields = Object.keys(body).filter((field) => !allowedFields.has(field))

  if (unknownFields.length > 0) {
    throw new Error(`Unsupported field: ${unknownFields[0]}`)
  }

  const update: QuoteUpdate = {}

  for (const field of allowedFields) {
    if (body[field] === undefined) {
      continue
    }

    if (typeof body[field] !== 'string') {
      throw new Error(`${field} must be a string.`)
    }

    const value = body[field].trim()
    if ((field === 'text' || field === 'bookTitle') && value.length === 0) {
      throw new Error(`${field} cannot be empty.`)
    }

    update[field as keyof QuoteUpdate] = value
  }

  if (Object.keys(update).length === 0) {
    throw new Error('At least one editable field is required.')
  }

  return update
}

export async function readQuotes() {
  const contents = await readFile(QUOTES_PATH, 'utf8')
  const parsed = JSON.parse(contents) as unknown

  if (!Array.isArray(parsed) || !parsed.every(isQuote)) {
    throw new Error('quotes.json does not match the expected quote format.')
  }

  return parsed
}

async function writeQuotes(quotes: Quote[]) {
  await writeFile(QUOTES_PATH, `${JSON.stringify(quotes, null, 2)}\n`)
}

export async function updateQuote(id: string, update: QuoteUpdate) {
  const quotes = await readQuotes()
  const index = quotes.findIndex((quote) => quote.id === id)

  if (index === -1) {
    return undefined
  }

  const nextQuote = {
    ...quotes[index],
    ...update,
  }

  quotes[index] = nextQuote
  await writeQuotes(quotes)
  return nextQuote
}

export async function deleteQuote(id: string) {
  const quotes = await readQuotes()
  const nextQuotes = quotes.filter((quote) => quote.id !== id)

  if (nextQuotes.length === quotes.length) {
    return false
  }

  await writeQuotes(nextQuotes)
  return true
}
