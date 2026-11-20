/**
 * SEO tag extraction.
 *
 * Pure function — no LLM call. Tokenizes the transcript, drops stop words,
 * counts term frequencies, and returns the top 5-10 most frequent tokens
 * as lowercase tags. Tags are de-duplicated by virtue of coming from a
 * `Map<string, number>`.
 */

import { tokenize, termFrequencies } from './tokenizer'

const MIN_TAGS = 5
const MAX_TAGS = 10

/**
 * Returns 5-10 SEO tags derived from keyword frequency in the transcript.
 *
 * - Tags are lowercase (the tokenizer lowercases input).
 * - Stop words are skipped by the tokenizer.
 * - Tags are de-duplicated (the frequency map keys are unique).
 * - Tags are ranked by descending frequency; ties broken alphabetically.
 *
 * If the transcript yields fewer than 5 unique content tokens, all
 * available tokens are returned (the caller can decide whether to pad).
 */
export function extractSeoTags(transcript: string, maxTags = 8): string[] {
  const tokens = tokenize(transcript)
  if (tokens.length === 0) return []

  const tf = termFrequencies(tokens)
  const sorted = Array.from(tf.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0].localeCompare(b[0])
  })

  const cap = Math.min(Math.max(MIN_TAGS, maxTags), MAX_TAGS)
  const take = Math.min(cap, sorted.length)
  return sorted.slice(0, take).map(([tok]) => tok)
}
