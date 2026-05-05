import cors from 'cors'
import express from 'express'
import { deleteQuote, readQuotes, updateQuote, validateQuoteUpdate } from './quotes-store.ts'

const app = express()
const port = Number(process.env.PORT ?? 8787)

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/api/quotes', async (_request, response) => {
  try {
    response.json(await readQuotes())
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to read quotes.' })
  }
})

app.patch('/api/quotes/:id', async (request, response) => {
  try {
    const update = validateQuoteUpdate(request.body)
    const quote = await updateQuote(request.params.id, update)

    if (!quote) {
      response.status(404).json({ error: 'Quote not found.' })
      return
    }

    response.json(quote)
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Invalid quote update.' })
  }
})

app.delete('/api/quotes/:id', async (request, response) => {
  try {
    const deleted = await deleteQuote(request.params.id)

    if (!deleted) {
      response.status(404).json({ error: 'Quote not found.' })
      return
    }

    response.status(204).send()
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to delete quote.' })
  }
})

app.listen(port, () => {
  console.log(`Local quote editing API listening at http://localhost:${port}`)
})
