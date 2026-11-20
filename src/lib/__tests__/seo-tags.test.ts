import { test, expect, describe } from 'bun:test'
import { extractSeoTags } from '../seo-tags'

describe('extractSeoTags — basic behaviour', () => {
  test('returns an array of strings', () => {
    const tags = extractSeoTags('podcast AI transcription show notes generation')
    expect(Array.isArray(tags)).toBe(true)
    for (const t of tags) expect(typeof t).toBe('string')
  })

  test('returns 5-10 tags for a content-rich transcript', () => {
    const t = [
      'Today we are talking about podcasting, AI, transcription, audio, editing,',
      'chapters, quotes, guests, bios, tweets, SEO tags, distribution, RSS feeds,',
      'microphones, hosting, marketing, audience growth, monetization, sponsors,',
      'show notes, chapters, quotes, transcripts, SEO, AI, podcasting.',
    ].join(' ')
    const tags = extractSeoTags(t)
    expect(tags.length).toBeGreaterThanOrEqual(5)
    expect(tags.length).toBeLessThanOrEqual(10)
  })

  test('returns [] for empty input', () => {
    expect(extractSeoTags('')).toEqual([])
  })
})

describe('extractSeoTags — stop words skipped', () => {
  test('does not include common stop words', () => {
    const tags = extractSeoTags('the and the of the podcast the and')
    // The only content word is "podcast"; stop words are filtered by the tokenizer.
    expect(tags).not.toContain('the')
    expect(tags).not.toContain('and')
    expect(tags).toContain('podcast')
  })

  test('does not include podcast filler words', () => {
    const tags = extractSeoTags('like you know really gonna gonna gonna AI AI AI')
    expect(tags).not.toContain('like')
    expect(tags).not.toContain('gonna')
    expect(tags).toContain('ai')
  })
})

describe('extractSeoTags — lowercase + dedupe', () => {
  test('returns lowercase tags', () => {
    const tags = extractSeoTags('Podcasting PODCASTING Podcasting AI ai')
    // Deduplicated -> 'podcasting' and 'ai' appear at most once each.
    expect(tags.every((t) => t === t.toLowerCase())).toBe(true)
  })

  test('deduplicates tokens (no duplicates in output)', () => {
    const tags = extractSeoTags('apple apple apple orange orange banana')
    expect(new Set(tags).size).toBe(tags.length)
  })
})

describe('extractSeoTags — ranked by frequency', () => {
  test('most frequent token appears first', () => {
    const text = [
      'apple apple apple apple',
      'banana banana banana',
      'cherry cherry',
      'date',
    ].join(' ')
    const tags = extractSeoTags(text, 4)
    expect(tags[0]).toBe('apple')
    expect(tags[1]).toBe('banana')
    expect(tags[2]).toBe('cherry')
    expect(tags[3]).toBe('date')
  })

  test('ties broken alphabetically', () => {
    const text = 'zebra zebra apple apple mango mango'
    const tags = extractSeoTags(text, 3)
    // All have frequency 2 -> alphabetical: apple, mango, zebra
    expect(tags).toEqual(['apple', 'mango', 'zebra'])
  })
})
