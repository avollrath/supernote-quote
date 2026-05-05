export type Quote = {
  id: string
  text: string
  fullText?: string
  bookTitle: string
  author: string
  language: 'en' | 'de'
  sourceFile: string
}

export type QuoteUpdate = Pick<Quote, 'text' | 'bookTitle' | 'author'>
