import staticQuotes from './data/quotes.json'
import type { Quote, QuoteUpdate } from './types'

export const fallbackQuotes = staticQuotes as Quote[]

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as { error?: string } | undefined
    throw new Error(body?.error ?? `Request failed with ${response.status}`)
  }

  return (await response.json()) as T
}

export async function loadAdminQuotes() {
  return parseJsonResponse<Quote[]>(await fetch('/api/quotes'))
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
