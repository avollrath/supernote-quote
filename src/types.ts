export type Quote = {
  id: string
  text: string
  bookTitle: string
  author: string
  language: 'en' | 'de'
  sourceFile: string
}

export type QuoteUpdate = Pick<Quote, 'text' | 'bookTitle' | 'author'>
