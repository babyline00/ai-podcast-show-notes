/**
 * Key quote extraction.
 *
 * The LLM is asked to return a JSON array of 3-5 quotable sentences. The
 * parser then estimates each quote's start timestamp by string-matching the
 * quote against the transcript and walking backwards to the nearest
 * preceding timestamp marker.
 */

import type { Quote } from './types'
import { getChatProvider } from './ai'

const TIMESTAMP_RE = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/

/**
 * Builds the user prompt asking the LLM for 3-5 quotes as JSON. The prompt
 * is explicit about the shape (array of `{ text }` objects) and the count
 * constraint so `parseQuotesResponse` can reliably JSON-parse the output.
 */
export function buildQuotePrompt(transcript: string): string {
  const excerpt = transcript.slice(0, 8000)
  return [
    'From the following podcast transcript, extract the 3 to 5 most quotable sentences.',
    'Choose sentences that are punchy, self-contained, and tweet-able.',
    '',
    'Return ONLY a JSON array of objects, each with a single "text" field containing the exact quote',
    '(no markdown, no surrounding quotation marks, no timestamps). Do not include any other fields.',
    '',
    'Example shape:',
    '[{"text":"Quote one."},{"text":"Quote two."},{"text":"Quote three."}]',
    '',
    'Transcript:',
    excerpt,
  ].join('\n')
}

/**
 * Estimates the start timestamp of `quote` by string-matching its first
 * 40 chars against `transcript` and walking backwards to the nearest
 * preceding `[MM:SS]` or `[HH:MM:SS]` marker. Returns 0 when no marker
 * precedes the match (or when the quote is not found).
 */
export function estimateQuoteTimestamp(quote: string, transcript: string): number {
  if (!quote || !transcript) return 0
  const needle = quote.slice(0, 40).toLowerCase()
  const idx = transcript.toLowerCase().indexOf(needle)
  if (idx === -1) return 0
  const before = transcript.slice(0, idx)
  const re = new RegExp(TIMESTAMP_RE.source, 'g')
  let m: RegExpExecArray | null
  let lastSec = 0
  while ((m = re.exec(before)) !== null) {
    const a = parseInt(m[1], 10)
    const b = parseInt(m[2], 10)
    const sec = m[3] !== undefined ? a * 3600 + b * 60 + parseInt(m[3], 10) : a * 60 + b
    lastSec = sec
  }
  return lastSec
}

/**
 * Parses the LLM's response into a `Quote[]`. The LLM is asked for 3-5
 * quotes; this parser tolerates 1-5 quotes (slicing any extras). Each
 * quote gets a `timestampSec` derived either from the LLM (if it provided
 * one) or from `estimateQuoteTimestamp` against the transcript.
 */
export function parseQuotesResponse(text: string, transcript: string): Quote[] {
  if (!text || !text.trim()) return []
  const parsed = tryParseJsonArray(text)
  if (!parsed) return []

  const quotes: Quote[] = parsed
    .filter((q: any) => q && typeof q.text === 'string' && q.text.trim().length > 0)
    .map((q: any) => {
      const text = String(q.text).trim()
      const timestampSec =
        typeof q.timestampSec === 'number' && Number.isFinite(q.timestampSec)
          ? Math.max(0, Math.floor(q.timestampSec))
          : estimateQuoteTimestamp(text, transcript)
      return { text, timestampSec }
    })

  return quotes.slice(0, 5)
}

function tryParseJsonArray(text: string): any[] | null {
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // fall through
  }
  // Try to extract the first [...] block — LLMs sometimes wrap JSON in prose.
  const match = text.match(/\[[\s\S]*\]/)
  if (match) {
    try {
      const parsed = JSON.parse(match[0])
      if (Array.isArray(parsed)) return parsed
    } catch {
      // ignore
    }
  }
  return null
}

/**
 * End-to-end: builds the prompt, calls the LLM, parses the result, and
 * attaches timestamps. Never throws — on any error returns `[]`.
 */
export async function extractQuotes(transcript: string): Promise<Quote[]> {
  try {
    const provider = getChatProvider()
    const systemPrompt =
      'You are a podcast editor who extracts the most quotable sentences from episode transcripts. ' +
      'Return only the JSON the user requested — no commentary, no markdown fences.'
    const userPrompt = buildQuotePrompt(transcript)
    const text = await provider.complete({ systemPrompt, userPrompt })
    return parseQuotesResponse(text, transcript)
  } catch (e) {
    console.warn('[extractQuotes] failed:', (e as Error).message)
    return []
  }
}
