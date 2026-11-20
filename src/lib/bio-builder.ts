/**
 * Guest bio builder.
 *
 * For each guest name, the LLM is asked to produce a 1-2 sentence bio. The
 * MVP does NOT have access to web search, so the bio is the LLM's best
 * guess from training data. Real bios (a stretch goal) would call
 * `zai.functions.invoke('web_search', ...)` to ground the bio in fresh
 * sources; see the README "What I'd do differently" section.
 */

import type { GuestBio } from './types'
import { getChatProvider } from './ai'

/**
 * Builds the prompt asking the LLM for a 1-2 sentence bio of `guestName`.
 * The prompt explicitly authorises the LLM to return the fallback bio
 * when it cannot confidently identify the person — this keeps fabricated
 * credentials out of the show notes.
 */
export function buildBioPrompt(guestName: string): string {
  return [
    `Write a 1-2 sentence bio for "${guestName}", who was a guest on a podcast.`,
    'Describe their role, company, and one piece of notable recent work if you can identify them confidently.',
    'If you cannot confidently identify the person, return exactly:',
    `Guest: ${guestName}. Bio not available.`,
    '',
    'Return only the plain-text bio — no markdown, no bullet points, no "Bio:" prefix.',
  ].join('\n')
}

/**
 * Parses the LLM response into a clean bio string. Strips surrounding
 * quotes and any leading/trailing whitespace. Returns an empty string
 * when the response is empty or whitespace-only — callers should fall
 * back to `fallbackBio(name)` in that case.
 */
export function parseBioResponse(text: string): string {
  if (!text) return ''
  const trimmed = text.trim()
  if (!trimmed) return ''
  // Strip wrapping quotes if the LLM added them.
  return trimmed.replace(/^["'`]+|["'`]+$/g, '').trim()
}

/** The bio used when no LLM is available or the LLM returned nothing usable. */
export function fallbackBio(name: string): string {
  return `Guest: ${name}. Bio not available.`
}

/**
 * Builds bios for a list of guest names. Always returns one `GuestBio`
 * per input name — on any error the bio falls back to `fallbackBio(name)`.
 */
export async function buildBios(guestNames: string[]): Promise<GuestBio[]> {
  const provider = getChatProvider()
  const systemPrompt =
    'You are a podcast producer writing concise guest bios. If you cannot confidently identify the person, ' +
    'return the fallback bio the user specified — do not invent credentials.'
  const results: GuestBio[] = []
  for (const name of guestNames) {
    const userPrompt = buildBioPrompt(name)
    try {
      const text = await provider.complete({ systemPrompt, userPrompt })
      const bio = parseBioResponse(text) || fallbackBio(name)
      results.push({ name, bio })
    } catch (e) {
      console.warn(`[buildBios] failed for "${name}":`, (e as Error).message)
      results.push({ name, bio: fallbackBio(name) })
    }
  }
  return results
}
