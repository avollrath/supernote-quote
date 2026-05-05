import { supabase } from './supabase'
import type { Quote, QuoteUpdate } from './types'

type QuoteRow = {
  id: string
  text: string
  book_title: string
  author: string | null
  language: 'en' | 'de'
  source_file: string | null
  created_at?: string
  updated_at?: string
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  return supabase
}

function fromQuoteRow(row: QuoteRow): Quote {
  return {
    id: row.id,
    text: row.text,
    bookTitle: row.book_title,
    author: row.author ?? '',
    language: row.language,
    sourceFile: row.source_file ?? '',
  }
}

function toQuoteUpdate(update: QuoteUpdate) {
  return {
    text: update.text.trim(),
    book_title: update.bookTitle.trim(),
    author: update.author.trim(),
  }
}

export async function fetchSupabaseQuotes() {
  const client = requireSupabase()
  const { data, error } = await client.from('quotes').select('*').order('book_title').order('text')

  if (error) {
    throw error
  }

  return (data as QuoteRow[]).map(fromQuoteRow)
}

export async function updateSupabaseQuote(id: string, update: QuoteUpdate) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('quotes')
    .update(toQuoteUpdate(update))
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return fromQuoteRow(data as QuoteRow)
}

export async function deleteSupabaseQuote(id: string) {
  const client = requireSupabase()
  const { error } = await client.from('quotes').delete().eq('id', id)

  if (error) {
    throw error
  }
}
