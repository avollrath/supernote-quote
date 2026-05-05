import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export type AppConfig = {
  displayQuoteMaxLength: number | null
}

const CONFIG_PATH = resolve('src/data/config.json')
const MIN_DISPLAY_QUOTE_LENGTH = 60
const MAX_DISPLAY_QUOTE_LENGTH = 1000

function isConfig(value: unknown): value is AppConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const config = value as Record<string, unknown>
  const displayQuoteMaxLength = config.displayQuoteMaxLength

  return (
    displayQuoteMaxLength === null ||
    (typeof displayQuoteMaxLength === 'number' &&
      Number.isInteger(displayQuoteMaxLength) &&
      displayQuoteMaxLength >= MIN_DISPLAY_QUOTE_LENGTH &&
      displayQuoteMaxLength <= MAX_DISPLAY_QUOTE_LENGTH)
  )
}

export function validateConfigUpdate(value: unknown): AppConfig {
  if (!isConfig(value)) {
    throw new Error('displayQuoteMaxLength must be null or an integer from 60 to 1000.')
  }

  return value
}

export async function readConfig() {
  const contents = await readFile(CONFIG_PATH, 'utf8')
  const parsed = JSON.parse(contents) as unknown

  if (!isConfig(parsed)) {
    throw new Error('config.json does not match the expected format.')
  }

  return parsed
}

export async function writeConfig(config: AppConfig) {
  await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`)
}
