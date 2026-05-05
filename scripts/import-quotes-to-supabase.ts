import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Quote } from '../src/types.ts'

type QuoteInsert = {
  id: string
  text: string
  book_title: string
  author: string
  language: 'en' | 'de'
  source_file: string
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const QUOTES_PATH = resolve('src/data/quotes.json')
const CHUNK_SIZE = 100

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
}

function toQuoteInsert(quote: Quote): QuoteInsert {
  return {
    id: quote.id,
    text: quote.text,
    book_title: quote.bookTitle,
    author: quote.author,
    language: quote.language,
    source_file: quote.sourceFile,
  }
}

const rawQuotes = await readFile(QUOTES_PATH, 'utf8')
const quotes = (JSON.parse(rawQuotes) as Quote[]).map(toQuoteInsert)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

let importedCount = 0

for (let index = 0; index < quotes.length; index += CHUNK_SIZE) {
  const chunk = quotes.slice(index, index + CHUNK_SIZE)
  const { error } = await supabase.from('quotes').upsert(chunk, {
    onConflict: 'id',
  })

  if (error) {
    throw error
  }

  importedCount += chunk.length
}

console.log(`Imported ${importedCount} quotes into Supabase.`)
