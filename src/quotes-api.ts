import staticQuotes from './data/quotes.json'
import { deleteSupabaseQuote, fetchSupabaseQuotes, updateSupabaseQuote } from './quotes-service'
import type { Quote, QuoteUpdate } from './types'

export const fallbackQuotes = staticQuotes as Quote[]

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
      error: error instanceof Error ? error.message : 'Unable to load quotes from Supabase.',
    }
  }
}

export async function updateQuote(id: string, update: QuoteUpdate) {
  return updateSupabaseQuote(id, update)
}

export async function deleteQuote(id: string) {
  await deleteSupabaseQuote(id)
}
