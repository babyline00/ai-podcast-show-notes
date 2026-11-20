/**
 * Tweet thread drafting.
 *
 * The LLM is asked to write a 3-tweet thread about the episode: one hook
 * tweet plus two follow-up tweets. Each tweet must be ≤ 280 characters.
 * The parser enforces the count (slicing to 3) and truncates any tweet
 * longer than 280 chars rather than dropping it.
 */

import type { Tweet } from './types'
import { getChatProvider } from './ai'

interface EpisodeSummary {
  title: string
  podcastName?: string | null
}

export const TWEET_MAX_CHARS = 280

/**
 * Builds the prompt asking the LLM for a 3-tweet thread. Includes the
 * episode title, podcast name, and a 2000-char transcript excerpt so the
 * tweets can be grounded in real content.
 */
export function buildTweetPrompt(
  episode: EpisodeSummary,
  transcript: string,
): string {
  const excerpt = transcript.slice(0, 2000)
  return [
    `Write a 3-tweet thread promoting this podcast episode.`,
    `Tweet 1 is the hook — a punchy opener that makes people want to listen.`,
    `Tweets 2 and 3 are follow-ups that each share one concrete insight from the episode.`,
    `Each tweet MUST be ≤ 280 characters.`,
    '',
    `Episode title: ${episode.title}`,
    `Podcast: ${episode.podcastName || 'N/A'}`,
    '',
    `Transcript excerpt:`,
    excerpt,
    '',
    `Return ONLY a JSON array of exactly 3 objects with this shape:`,
    `[{"kind":"hook","text":"..."},{"kind":"followup","text":"..."},{"kind":"followup","text":"..."}]`,
  ].join('\n')
}

/**
 * Parses the LLM response into a `Tweet[]`. Enforces:
 *   - The result has at most 3 tweets.
 *   - Each tweet text is truncated to 280 chars.
 *   - The first tweet is tagged `hook`; the rest are `followup`.
 *   - Tweets with empty text are dropped.
 */
export function parseTweetsResponse(text: string): Tweet[] {
  if (!text || !text.trim()) return []
  let parsed: any
  try {
    parsed = JSON.parse(text)
  } catch {
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return []
    try {
      parsed = JSON.parse(match[0])
    } catch {
      return []
    }
  }
  if (!Array.isArray(parsed)) return []

  const tweets: Tweet[] = parsed
    .filter((t: any) => t && typeof t.text === 'string')
    .map((t: any, i: number) => {
      const rawText = String(t.text).trim()
      const kind: Tweet['kind'] = i === 0 ? 'hook' : 'followup'
      const truncated = rawText.slice(0, TWEET_MAX_CHARS)
      return { kind, text: truncated }
    })
    .filter((t: Tweet) => t.text.length > 0)

  return tweets.slice(0, 3)
}

/**
 * End-to-end: builds the prompt, calls the LLM, parses the result. Never
 * throws — on any error returns `[]`.
 */
export async function buildTweetThread(
  episode: EpisodeSummary,
  transcript: string,
): Promise<Tweet[]> {
  try {
    const provider = getChatProvider()
    const systemPrompt =
      'You are a podcast marketer writing tweet threads that drive listens. ' +
      'Return only the JSON the user requested — no commentary, no markdown fences.'
    const userPrompt = buildTweetPrompt(episode, transcript)
    const text = await provider.complete({ systemPrompt, userPrompt })
    return parseTweetsResponse(text)
  } catch (e) {
    console.warn('[buildTweetThread] failed:', (e as Error).message)
    return []
  }
}
