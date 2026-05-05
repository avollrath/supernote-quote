import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

type Quote = {
  id: string
  text: string
  fullText?: string
  bookTitle: string
  author: string
  language: 'en' | 'de'
}

const INPUT_PATH = resolve('data/raw/quotes_normalized.txt')
const OUTPUT_PATH = resolve('src/data/quotes.json')
const MAX_DISPLAY_LENGTH = 1200

const germanCharactersPattern = /[äöüßÄÖÜÃ¤Ã¶Ã¼ÃŸÃ„Ã–Ãœ]/
const strongGermanPattern =
  /\b(gewohnheit|gewÃ¶hnheit|veränderung|verÃ¤nderung|glück|glÃ¼ck|verhaltensänderung|verhaltensÃ¤nderung)\b/i
const germanWords = new Set([
  'der',
  'die',
  'das',
  'und',
  'nicht',
  'sich',
  'sie',
  'ist',
  'ein',
  'eine',
  'mit',
  'für',
  'fÃ¼r',
  'auf',
  'dass',
  'daß',
  'werden',
  'haben',
  'menschen',
  'verhalten',
])

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?…]["”’»)]?)\s+(?=[A-ZÄÖÜÃ„Ã–Ãœ“"‘])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

export function formatQuote(text: string): string {
  if (text.length <= 200) {
    return text
  }

  if (/[•â€¢]/.test(text)) {
    const bullet = text.includes('•') ? '•' : 'â€¢'
    const [header, ...items] = text
      .split(new RegExp(`\\s*${bullet}\\s*`))
      .map((part) => part.trim())
      .filter(Boolean)
    const lines = items.length > 0 ? [header, ...items.map((item) => `${bullet} ${item}`)] : [text]

    if (lines.length <= 4) {
      return lines.join('\n')
    }

    return [...lines.slice(0, 3), lines.slice(3).join(' ')].join('\n')
  }

  const numbered = text.replace(/\s+(\d+\.)\s+(?=[A-ZÄÖÜÃ„Ã–Ãœ])/g, '\n$1 ')
  if (numbered.includes('\n')) {
    const lines = numbered.split('\n')
    if (lines.length <= 4) {
      return numbered
    }

    return [...lines.slice(0, 3), lines.slice(3).join(' ')].join('\n')
  }

  const sentences = splitSentences(text)
  if (sentences.length <= 1) {
    return text
  }

  const maxLines = text.length > 700 ? 4 : text.length > 420 ? 3 : 2
  const targetLength = Math.ceil(text.length / maxLines)
  const lines: string[] = []
  let currentLine = ''

  for (const sentence of sentences) {
    const nextLine = currentLine ? `${currentLine} ${sentence}` : sentence

    if (currentLine && nextLine.length > targetLength && lines.length < maxLines - 1) {
      lines.push(currentLine)
      currentLine = sentence
    } else {
      currentLine = nextLine
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines.slice(0, maxLines).join('\n')
}

function detectLanguage(text: string): 'en' | 'de' {
  if (germanCharactersPattern.test(text) || strongGermanPattern.test(text)) {
    return 'de'
  }

  const words = text.toLowerCase().match(/\p{L}+/gu) ?? []
  const germanWordHits = words.filter((word) => germanWords.has(word)).length
  return germanWordHits >= 3 ? 'de' : 'en'
}

function createId(text: string, source: string) {
  const hash = createHash('sha1').update(`${text}\n${source}`).digest('hex').slice(0, 12)
  const slug = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)

  return `${slug || 'quote'}-${hash}`
}

function parseSource(sourceLine: string, entryNumber: number) {
  const separatorIndex = sourceLine.indexOf(' - ')

  if (separatorIndex === -1) {
    throw new Error(`Entry ${entryNumber} source line must contain " - ".`)
  }

  const bookTitle = sourceLine.slice(0, separatorIndex).trim()
  const author = sourceLine.slice(separatorIndex + 3).trim()

  if (!bookTitle || !author) {
    throw new Error(`Entry ${entryNumber} source line must include both book title and author.`)
  }

  return { bookTitle, author }
}

function parseNormalizedQuotes(raw: string) {
  const blocks = raw
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean)

  const seenTexts = new Set<string>()
  const quotes: Quote[] = []

  blocks.forEach((block, index) => {
    const entryNumber = index + 1
    const lines = block.split('\n').map((line) => line.trim())

    if (lines.length !== 2 || lines.some((line) => line.length === 0)) {
      throw new Error(`Entry ${entryNumber} must contain exactly 2 non-empty lines.`)
    }

    const [rawText, sourceLine] = lines
    const { bookTitle, author } = parseSource(sourceLine, entryNumber)
    const formattedText = formatQuote(rawText)
    const dedupeKey = rawText.toLowerCase()

    if (seenTexts.has(dedupeKey)) {
      return
    }

    seenTexts.add(dedupeKey)

    const quote: Quote = {
      id: createId(rawText, sourceLine),
      text: formattedText.length > MAX_DISPLAY_LENGTH ? `${formattedText.slice(0, MAX_DISPLAY_LENGTH - 1).trim()}…` : formattedText,
      bookTitle,
      author,
      language: detectLanguage(rawText),
    }

    if (formattedText.length > MAX_DISPLAY_LENGTH) {
      quote.fullText = formattedText
    }

    quotes.push(quote)
  })

  return quotes.sort((a, b) => a.bookTitle.localeCompare(b.bookTitle) || a.text.localeCompare(b.text))
}

const raw = readFileSync(INPUT_PATH, 'utf8')
const quotes = parseNormalizedQuotes(raw)

mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
writeFileSync(OUTPUT_PATH, `${JSON.stringify(quotes, null, 2)}\n`)

const counts = quotes.reduce(
  (total, quote) => {
    total[quote.language] += 1
    return total
  },
  { en: 0, de: 0 },
)

console.log(`Parsed ${quotes.length} quotes (${counts.en} English, ${counts.de} German)`)
