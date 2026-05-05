import staticQuotes from './data/quotes.json'
import { fetchSupabaseQuotes } from './quotes-service'
import type { Quote, QuoteUpdate } from './types'

export const fallbackQuotes = staticQuotes as Quote[]

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as { error?: string } | undefined
    throw new Error(body?.error ?? `Request failed with ${response.status}`)
  }

  return (await response.json()) as T
}

export async function loadQuotes() {
  return (await loadQuotesWithFallback()).quotes
}

export async function loadQuotesWithFallback() {
  try {
    return {
      quotes: await fetchSupabaseQuotes(),
      didFallback: false,
      error: '',
    }
  } catch (error) {
    return {
      quotes: fallbackQuotes,
      didFallback: true,
      error: error instanceof Error ? error.message : 'Unable to load quotes from the local API.',
    }
  }
}

export async function updateQuote(id: string, update: QuoteUpdate) {
  return parseJsonResponse<Quote>(
    await fetch(`/api/quotes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(update),
    }),
  )
}

export async function deleteQuote(id: string) {
  const response = await fetch(`/api/quotes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as { error?: string } | undefined
    throw new Error(body?.error ?? `Request failed with ${response.status}`)
  }
}
