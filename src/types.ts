export type Quote = {
  id: string
  text: string
  fullText?: string
  bookTitle: string
  author: string
  language: 'en' | 'de'
}

export type QuoteUpdate = Pick<Quote, 'text' | 'bookTitle' | 'author'>

export type AppConfig = {
  displayQuoteMaxLength: number | null
}
