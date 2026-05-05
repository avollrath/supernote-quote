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
  sourceFile: string
}

const RAW_PATH = resolve('data/raw/Documents.txt')
const OUTPUT_PATH = resolve('src/data/quotes.json')
const MAX_DISPLAY_LENGTH = 1200

const archivePatterns = [
  /\bAnna(?:'|’|s)?s Archive\b/gi,
  /\bZ-?Library\b/gi,
  /\bz-?lib(?:\.org)?\b/gi,
  /\blibgen(?:\.\w+)?\b/gi,
]

const germanCharactersPattern = /[äöüßÄÖÜ]/
const strongGermanPattern = /\b(gewohnheit|veränderung|glück|verhaltensänderung)\b/i
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
    '\u00e2\u20ac\u2122': '’',
    '\u00e2\u20ac\u0153': '“',
    '\u00e2\u20ac\u009d': '”',
    '\u00e2\u20ac\u02dc': '‘',
    '\u00e2\u20ac\u201c': '–',
    '\u00e2\u20ac\u201d': '—',
    '\u00e2\u20ac\u00a2': '•',
    '\u00e2\u20ac\u00a6': '…',
    '\u00c2\u00bb': '»',
    '\u00c2\u00ab': '«',
    '\u00c2 ': ' ',
  }

  let repaired = value
  for (const [broken, fixed] of Object.entries(commonRepairs)) {
    repaired = repaired.replaceAll(broken, fixed)
  }

  if (/[ÃÂ]/.test(repaired)) {
    try {
      const bytes = Uint8Array.from([...repaired].map((char) => char.charCodeAt(0) & 0xff))
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
      if (!decoded.includes('�')) {
        repaired = decoded
      }
    } catch {
      // Keep the best-effort repaired value.
    }
  }

  return repaired
}

function protectPunctuation(text: string) {
  const tokens: string[] = []
  const protect = (match: string) => {
    const token = `__TOKEN_${tokens.length}__`
    tokens.push(match)
    return token
  }

  const protectedText = text
    .replace(/\b(?:e\.g|i\.e|U\.S|U\.K|Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc)\./g, protect)
    .replace(/\b(?:[A-Z]\.){2,}/g, protect)
    .replace(/\b\d+\.\d+\b/g, protect)

  return { protectedText, tokens }
}

function restorePunctuation(text: string, tokens: string[]) {
  return tokens.reduce((current, token, index) => current.replaceAll(`__TOKEN_${index}__`, token), text)
}

export function normalizeText(text: string): string {
  const lines = repairMojibake(text)
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  let joined = ''

  for (const line of lines) {
    if (!joined) {
      joined = line
      continue
    }

    const previousEndsCleanly = /[.!?;:…)"'”’»\]]$/.test(joined)
    joined += previousEndsCleanly ? ` ${line}` : ` ${line}`
  }

  const { protectedText, tokens } = protectPunctuation(joined)
  const spaced = protectedText
    .replace(/■/g, '•')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+([)\]”»])/g, '$1')
    .replace(/([A-Za-zÄÖÜäöüß])\(/g, '$1 (')
    .replace(/\)([A-Za-zÄÖÜäöüß])/g, ') $1')
    .replace(/([,;:!?])(?=\S)/g, '$1 ')
    .replace(/\.([)"'”’»\]]*)(?=[A-ZÄÖÜ0-9“"‘])/g, '.$1 ')
    .replace(/([)\]”»])(?=\d|[A-ZÄÖÜ])/g, '$1 ')
    .replace(/(?<!M)([a-zäöüß])([A-ZÄÖÜ][a-zäöüß])/g, '$1 $2')
    .replace(/\binthe\b/gi, 'in the')
    .replace(/\bofthe\b/gi, 'of the')
    .replace(/\btothe\b/gi, 'to the')
    .replace(/\bandthe\b/gi, 'and the')
    .replace(/\bforthe\b/gi, 'for the')
    .replace(/\borweeks\b/gi, 'or weeks')
    .replace(/\bormonths\b/gi, 'or months')
    .replace(/\boryears\b/gi, 'or years')
    .replace(/\bwhathe\b/gi, 'what he')
    .replace(/\bunderstoodyour\b/gi, 'understood your')
    .replace(/\bamedicine\b/gi, 'a medicine')
    .replace(/\byouvery\b/gi, 'you very')
    .replace(/\brelationshipshas\b/gi, 'relationships has')
    .replace(/\bpleasepeople\b/gi, 'please people')
    .replace(/\bfeelinauthentic\b/gi, 'feel inauthentic')
    .replace(/\bforpremarital\b/gi, 'for premarital')
    .replace(/\bfeltit\b/gi, 'felt it')
    .replace(/\bceremonyanyway\b/gi, 'ceremony anyway')
    .replace(/\bwereexpecting\b/gi, 'were expecting')
    .replace(/\boneperson\b/gi, 'one person')
    .replace(/\bacertain\b/gi, 'a certain')
    .replace(/\bregularlywant\b/gi, 'regularly want')
    .replace(/\bwhodon’t\b/gi, 'who don’t')
    .replace(/\bpersonand\b/gi, 'person and')
    .replace(/\bveryrough\b/gi, 'very rough')
    .replace(/\bscenariosone\b/gi, 'scenarios one')
    .replace(/\bthatmight\b/gi, 'that might')
    .replace(/\bunsanitaryaspects\b/gi, 'unsanitary aspects')
    .replace(/\bdislikesor\b/gi, 'dislikes or')
    .replace(/\bapsychologically\b/gi, 'a psychologically')
    .replace(/\bunfamiliarbut\b/gi, 'unfamiliar but')
    .replace(/\balwaysbelong\b/gi, 'always belong')
    .replace(/\bseriousway\b/gi, 'serious way')
    .replace(/\bourpartner\b/gi, 'our partner')
    .replace(/\binincreasing\b/gi, 'in increasing')
    .replace(/\bincirculation\b/gi, 'in circulation')
    .replace(/\buniqueincapacity\b/gi, 'unique incapacity')
    .replace(/\bofhuman\b/gi, 'of human')
    .replace(/\banotherbecause\b/gi, 'another because')
    .replace(/\bisspecial\b/gi, 'is special')
    .replace(/\banddomestic\b/gi, 'and domestic')
    .replace(/\bmorehopeful\b/gi, 'more hopeful')
    .replace(/\bThesecond\b/g, 'The second')
    .replace(/\bwhichmeans\b/gi, 'which means')
    .replace(/\bmeansconcentrated\b/gi, 'means concentrated')
    .replace(/\blivingthings\b/gi, 'living things')
    .replace(/\bthatabsurd\b/gi, 'that absurd')
    .replace(/\basleepalways\b/gi, 'asleep always')
    .replace(/\byou’resuffering\b/gi, 'you’re suffering')
    .replace(/\bHowwonderful\b/g, 'How wonderful')
    .replace(/\botherperson\b/gi, 'other person')
    .replace(/\bcomplexinner\b/gi, 'complex inner')
    .replace(/\bisthinking\b/gi, 'is thinking')
    .replace(/\btoyourself\b/gi, 'to yourself')
    .replace(/\bvocabularyaltogether\b/gi, 'vocabulary altogether')
    .replace(/\bmakingthis\b/gi, 'making this')
    .replace(/\byourparents\b/gi, 'your parents')
    .replace(/\bsomethingbecause\b/gi, 'something because')
    .replace(/\bfollowingquestions\b/gi, 'following questions')
    .replace(/\bfromtoday\b/gi, 'from today')
    .replace(/\bgoingthrough\b/gi, 'going through')
    .replace(/\bsomethingthat\b/gi, 'something that')
    .replace(/\bWhetherthey\b/g, 'Whether they')
    .replace(/\s+/g, ' ')

  return restorePunctuation(spaced, tokens)
    .replace(/([A-Za-zÄÖÜäöüß])\u2019\s+(t|s|re|ve|ll|d|m)\b/gi, '$1\u2019$2')
    .replace(/\u2019\s+(t|s|re|ve|ll|d|m)\b/gi, '\u2019$1')
    .replace(/([,.!?;:])\s+([)”»])/g, '$1$2')
    .replace(/(“[^”]{1,60}”)(?=[A-Za-zÄÖÜäöüß])/g, '$1 ')
    .replace(/(‘[^’]{1,30}’)(?=[A-Za-zÄÖÜäöüß])/g, '$1 ')
    .replace(/([.!?])\s+\d+$/g, '$1')
    .replace(/^[.,;:!?]\s+/, '')
    .trim()
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?…]["”’»)]?)\s+(?=[A-ZÄÖÜ“"‘])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

export function formatQuote(text: string): string {
  if (text.length <= 200) {
    return text
  }

  if (/[•]/.test(text)) {
    const [header, ...items] = text.split(/\s*•\s*/).map((part) => part.trim()).filter(Boolean)
    const lines = items.length > 0 ? [header, ...items.map((item) => `• ${item}`)] : [text]
    if (lines.length <= 4) {
      return lines.join('\n')
    }

    return [...lines.slice(0, 3), lines.slice(3).join(' ')].join('\n')
  }

  const numbered = text.replace(/\s+(\d+\.)\s+(?=[A-ZÄÖÜ])/g, '\n$1 ')
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

function normalizeWhitespace(value: string) {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()
}

function cleanAuthor(value: string) {
  let author = normalizeWhitespace(value)
    .replace(/\bby\b/gi, '')
    .replace(/\bGerman Edition\b/gi, '')
    .replace(/\b\d{4}\b/g, '')
    .replace(/[()[\]]/g, '')
    .replace(/[,.;:-]+$/g, '')
    .trim()

  const commaParts = author
    .split(',')
    .map((part) => normalizeWhitespace(part.replace(/\./g, '')))
    .filter(Boolean)

  if (commaParts.length === 2) {
    author = `${commaParts[1]} ${commaParts[0]}`
  } else if (commaParts.length === 4) {
    author = `${commaParts[1]} ${commaParts[0]}, ${commaParts[2]} ${commaParts[3]}`
  }

  if (!author || /\d|archive|library|epub|isbn|edition|hamish|harmony|potter|publisher/i.test(author)) {
    return ''
  }

  return author
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*\.\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function looksLikePerson(value: string) {
  const words = value.trim().split(/\s+/)
  return (
    words.length >= 2 &&
    words.length <= 4 &&
    words.every((word) => /^(?:de|da|di|van|von|[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.'-]+)$/.test(word))
  )
}

function cleanTitle(value: string) {
  let title = normalizeWhitespace(value)
    .replace(/_/g, ': ')
    .replace(/\bGerman Edition\b/gi, '')
    .replace(/\([^)]*(?:edition|archive|library|publisher|press|\b\d{4}\b)[^)]*\)/gi, '')
    .replace(/\[[^\]]*(?:edition|archive|library|z-lib|libgen)[^\]]*\]/gi, '')
    .replace(/\b(?:19|20)\d{2}\b/g, '')
    .replace(/\b97[89][-\d]{8,}\b/g, '')
    .replace(/\b[0-9a-f]{24,}\b/gi, '')

  for (const pattern of archivePatterns) {
    title = title.replace(pattern, '')
  }

  title = title
    .replace(/\s+-\s+\.\w+$/g, '')
    .replace(/\s*[,;:]\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  if (/^Die 1-Methode\b/.test(title)) {
    title = title.replace(/\s+Mit kleinen Gewohnheiten.*$/i, '')
  }

  return title.replace(/[()[\]\s.-]+$/g, '').trim()
}

export function normalizeSource(raw: string): { bookTitle: string; author: string } {
  const sourceText = repairMojibake(raw)
  let source = sourceText.match(/^\[(.*?)](?:\(.*\))?$/)?.[1] ?? sourceText

  source = source
    .replace(/\\/g, '/')
    .split('/')
    .at(-1) ?? source

  source = source.replace(/\.epub$/i, '').replace(/_/g, ': ')

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
    const parentheticalMatches = [...source.matchAll(/\(([^()]+)\)/g)].map((match) => normalizeWhitespace(match[1]))

    if (byMatch) {
      bookTitle = byMatch[1]
      author = cleanAuthor(byMatch[2])
    } else {
      const candidate = parentheticalMatches.find((part) => looksLikePerson(part) && !/edition|archive|library|\d/i.test(part))
      if (candidate) {
        author = cleanAuthor(candidate)
        bookTitle = source.replace(`(${candidate})`, '')
      } else {
        const singleDashParts = source.split(/\s+-\s+/).map((part) => normalizeWhitespace(part)).filter(Boolean)
        if (singleDashParts.length >= 2) {
          const [first, ...rest] = singleDashParts
          const last = rest.at(-1) ?? ''

          if (looksLikePerson(first)) {
            author = cleanAuthor(first)
            bookTitle = rest.join(' - ')
          } else if (last.includes(',') || looksLikePerson(last)) {
            author = cleanAuthor(last)
            bookTitle = [first, ...rest.slice(0, -1)].join(' - ')
          }
        }
      }
    }
  }

  return {
    bookTitle: cleanTitle(bookTitle),
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

    const normalizedText = normalizeText(lines.slice(0, -1).join('\n'))
    const formattedText = formatQuote(normalizedText)
    const dedupeKey = normalizedText.toLowerCase()

    if (!formattedText || seenTexts.has(dedupeKey)) {
      continue
    }

    seenTexts.add(dedupeKey)
    const sourceFile = repairMojibake(sourceLine)
    const { bookTitle, author } = normalizeSource(sourceFile)
    const quote: Quote = {
      id: createId(normalizedText, sourceFile),
      text: formattedText.length > MAX_DISPLAY_LENGTH ? `${formattedText.slice(0, MAX_DISPLAY_LENGTH - 1).trim()}…` : formattedText,
      bookTitle,
      author,
      language: detectLanguage(normalizedText),
      sourceFile,
    }

    if (formattedText.length > MAX_DISPLAY_LENGTH) {
      quote.fullText = formattedText
    }

    quotes.push(quote)
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
