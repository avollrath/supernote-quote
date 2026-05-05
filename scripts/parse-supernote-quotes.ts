import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

type Quote = {
  id: string
  text: string
  bookTitle: string
  author: string
  language: 'en' | 'de'
  sourceFile: string
}

const RAW_PATH = resolve('data/raw/Documents.txt')
const OUTPUT_PATH = resolve('src/data/quotes.json')

const archivePatterns = [
  /\bAnna(?:'|’|â€™)?s Archive\b/gi,
  /\bZ-?Library\b/gi,
  /\bz-?lib(?:\.org)?\b/gi,
  /\blibgen(?:\.\w+)?\b/gi,
]

const germanCharactersPattern = /[äöüßÄÖÜ]/
const strongGermanPattern = /\b(gewonheit|gewohnheit|veranderung|veränderung|gluck|glück|verhaltensänderung)\b/i
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
  'fur',
  'für',
  'auf',
  'dass',
  'daß',
  'werden',
  'haben',
  'menschen',
  'verhalten',
])

function repairMojibake(value: string) {
  const commonRepairs: Record<string, string> = {
    'â€™': '’',
    'â€œ': '“',
    'â€': '”',
    'â€˜': '‘',
    'â€“': '–',
    'â€”': '—',
    'â€¢': '•',
    'â€¦': '…',
    'Â»': '»',
    'Â«': '«',
    'Â ': ' ',
    'Ã„': 'Ä',
    'Ã–': 'Ö',
    'Ãœ': 'Ü',
    'Ã¤': 'ä',
    'Ã¶': 'ö',
    'Ã¼': 'ü',
    'ÃŸ': 'ß',
    'Ã©': 'é',
  }

  let repaired = value
  for (const [broken, fixed] of Object.entries(commonRepairs)) {
    repaired = repaired.replaceAll(broken, fixed)
  }

  if (repaired !== value) {
    return repaired
  }

  if (!/[ÃÂâ]/.test(value)) {
    return value
  }

  const bytes = Uint8Array.from([...value].map((char) => char.charCodeAt(0) & 0xff))
  return new TextDecoder('utf-8').decode(bytes)
}

function normalizeWhitespace(value: string) {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()
}

function cleanQuoteText(value: string) {
  return normalizeWhitespace(repairMojibake(value))
    .replace(/^\.\s+(?=\p{Lu}|\p{N}|["“»])/u, '')
    .replace(/^,\s+(?=\p{Lu}|\p{N}|["“»])/u, '')
    .trim()
}

function cleanMetadataText(value: string) {
  let cleaned = repairMojibake(value)
    .replace(/^\[/, '')
    .replace(/\]\(.+\)$/, '')
    .replace(/\.epub$/i, '')
    .replace(/_/g, ' ')

  for (const pattern of archivePatterns) {
    cleaned = cleaned.replace(pattern, '')
  }

  cleaned = cleaned
    .replace(/\b97[89][-\d]{8,}\b/g, '')
    .replace(/\b[0-9a-f]{24,}\b/gi, '')
    .replace(/\s+-\s+\.\w+$/g, '')
    .replace(/\[(.*?)\]/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+--\s+$/g, '')
    .replace(/\s{2,}/g, ' ')

  return normalizeWhitespace(cleaned)
}

function titleCaseName(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) =>
      part
        .split('-')
        .map((piece) =>
          piece.length > 1 ? piece.charAt(0).toUpperCase() + piece.slice(1).toLowerCase() : piece.toUpperCase(),
        )
        .join('-'),
    )
    .join(' ')
}

function cleanAuthor(value: string) {
  let author = normalizeWhitespace(value)
    .replace(/\bby\b/gi, '')
    .replace(/\bGerman Edition\b/gi, '')
    .replace(/\b\d{4}\b/g, '')
    .replace(/[()[\]]/g, '')
    .replace(/[,.;:-]+$/g, '')
    .trim()

  if (!author || /\d|archive|library|epub|isbn|edition/i.test(author)) {
    return ''
  }

  if (/^[A-Z][a-z]+,\s*[A-Z]/.test(author)) {
    const [last, ...rest] = author.split(',')
    author = `${rest.join(' ').trim()} ${last.trim()}`
  }

  return titleCaseName(author)
}

function parseSource(sourceFile: string) {
  const source = cleanMetadataText(sourceFile)
  let bookTitle = source
  let author = ''

  const dashParts = source
    .split(/\s+--\s+/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  if (dashParts.length >= 2) {
    bookTitle = dashParts[0]
    author = cleanAuthor(dashParts[1])
  } else {
    const byMatch = source.match(/^(.+?)\s+by\s+([^()[\]]+)(?:\s|$)/i)
    const parentheticalMatches = [...source.matchAll(/\(([^()]+)\)/g)].map((match) => match[1])

    if (byMatch) {
      bookTitle = byMatch[1]
      author = cleanAuthor(byMatch[2])
    } else if (parentheticalMatches.length > 0) {
      const candidate = parentheticalMatches.find((part) => {
        const words = part.trim().split(/\s+/)
        return words.length >= 2 && words.length <= 4 && !/edition|archive|library|z-lib|isbn|\d/i.test(part)
      })

      if (candidate) {
        author = cleanAuthor(candidate)
        bookTitle = source.replace(`(${candidate})`, '')
      }
    }
  }

  bookTitle = normalizeWhitespace(
    bookTitle
      .replace(/\bGerman Edition\b/gi, '')
      .replace(/\([^)]*(?:Edition|Archive|Library|z-lib|libgen)[^)]*\)/gi, '')
      .replace(/\[[^\]]*(?:Edition|Archive|Library|z-lib|libgen)[^\]]*\]/gi, '')
      .replace(/\s+by\s+[^()[\]]+$/i, '')
      .replace(/\s{2,}/g, ' '),
  )

  return {
    bookTitle: bookTitle.replace(/[()[\]\s.-]+$/g, '').trim(),
    author,
  }
}

function detectLanguage(text: string): 'en' | 'de' {
  if (germanCharactersPattern.test(text) || strongGermanPattern.test(text)) {
    return 'de'
  }

  const words = text.toLowerCase().match(/\p{L}+/gu) ?? []
  const germanWordHits = words.filter((word) => germanWords.has(word)).length
  return germanWordHits >= 3 ? 'de' : 'en'
}

function createId(text: string, sourceFile: string) {
  const hash = createHash('sha1').update(`${text}\n${sourceFile}`).digest('hex').slice(0, 12)
  const slug = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)

  return `${slug || 'quote'}-${hash}`
}

function parseExport(raw: string) {
  const normalizedRaw = raw.replace(/\r\n/g, '\n')
  const blocks = normalizedRaw.split(/\n{2,}/)
  const seenTexts = new Set<string>()
  const quotes: Quote[] = []

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length < 2) {
      continue
    }

    const sourceLine = lines.at(-1)
    if (!sourceLine?.startsWith('[')) {
      continue
    }

    const text = cleanQuoteText(lines.slice(0, -1).join(' '))
    if (!text || seenTexts.has(text)) {
      continue
    }

    seenTexts.add(text)
    const sourceFile = repairMojibake(sourceLine)
    const { bookTitle, author } = parseSource(sourceFile)

    quotes.push({
      id: createId(text, sourceFile),
      text,
      bookTitle,
      author,
      language: detectLanguage(text),
      sourceFile,
    })
  }

  return quotes.sort((a, b) => a.bookTitle.localeCompare(b.bookTitle) || a.text.localeCompare(b.text))
}

const raw = readFileSync(RAW_PATH, 'utf8')
const quotes = parseExport(raw)

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
