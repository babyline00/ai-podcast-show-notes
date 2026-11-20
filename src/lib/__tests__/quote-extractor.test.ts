import { test, expect, describe } from 'bun:test'
import {
  buildQuotePrompt,
  parseQuotesResponse,
  estimateQuoteTimestamp,
  extractQuotes,
} from '../quote-extractor'
import { __setChatProviderForTest, type ChatProvider } from '../ai'

describe('buildQuotePrompt', () => {
  test('asks for 3-5 quotable sentences', () => {
    const p = buildQuotePrompt('some transcript text')
    expect(p.toLowerCase()).toContain('quotable')
    expect(p).toMatch(/3.*5/) // "3 to 5" or "3-5"
  })
  test('includes the transcript', () => {
    const p = buildQuotePrompt('the unique sentinel phrase appears here')
    expect(p).toContain('the unique sentinel phrase appears here')
  })
  test('asks for JSON array shape', () => {
    const p = buildQuotePrompt('x')
    expect(p.toLowerCase()).toContain('json')
  })
})

describe('parseQuotesResponse', () => {
  test('parses valid JSON array, attaches timestamps', () => {
    const transcript = '[00:00] Hello world.\n[00:30] The future is bright.'
    const text = JSON.stringify([
      { text: 'Hello world.' },
      { text: 'The future is bright.' },
      { text: 'Third quote here.' },
      { text: 'Fourth quote here.' },
    ])
    const quotes = parseQuotesResponse(text, transcript)
    expect(quotes.length).toBeGreaterThanOrEqual(3)
    expect(quotes.length).toBeLessThanOrEqual(5)
    for (const q of quotes) {
      expect(typeof q.text).toBe('string')
      expect(q.text.length).toBeGreaterThan(0)
      expect(typeof q.timestampSec).toBe('number')
      expect(q.timestampSec).toBeGreaterThanOrEqual(0)
    }
  })

  test('timestamps estimate from string match against transcript', () => {
    const transcript = '[00:00] intro line.\n[00:42] the future is already here.\n[01:30] outro.'
    const text = JSON.stringify([{ text: 'the future is already here.' }])
    const quotes = parseQuotesResponse(text, transcript)
    expect(quotes[0].timestampSec).toBe(42)
  })

  test('caps at 5 quotes', () => {
    const text = JSON.stringify([
      { text: 'one.' },
      { text: 'two.' },
      { text: 'three.' },
      { text: 'four.' },
      { text: 'five.' },
      { text: 'six.' },
      { text: 'seven.' },
    ])
    const quotes = parseQuotesResponse(text, 'transcript')
    expect(quotes).toHaveLength(5)
  })

  test('gracefully handles malformed JSON', () => {
    expect(parseQuotesResponse('not json at all', 'transcript')).toEqual([])
  })

  test('extracts JSON array from prose wrapper', () => {
    const text = 'Here are the quotes:\n[{"text":"Quote one."},{"text":"Quote two."},{"text":"Quote three."}]\nDone.'
    const quotes = parseQuotesResponse(text, 'transcript')
    expect(quotes).toHaveLength(3)
    expect(quotes[0].text).toBe('Quote one.')
  })

  test('empty input returns []', () => {
    expect(parseQuotesResponse('', 'transcript')).toEqual([])
  })
})

describe('estimateQuoteTimestamp', () => {
  test('returns 0 when quote is not found', () => {
    expect(estimateQuoteTimestamp('nonexistent quote', 'some transcript')).toBe(0)
  })
  test('returns nearest preceding timestamp', () => {
    const transcript = '[00:00] intro.\n[00:30] the punchy quote is here.\n[01:00] more.'
    expect(estimateQuoteTimestamp('the punchy quote is here', transcript)).toBe(30)
  })
  test('returns 0 when no preceding timestamp', () => {
    const transcript = 'no markers here. the punchy quote is here.'
    expect(estimateQuoteTimestamp('the punchy quote is here', transcript)).toBe(0)
  })
})

describe('extractQuotes (end-to-end via MockProvider)', () => {
  class MockChat implements ChatProvider {
    async complete(args: { systemPrompt: string; userPrompt: string }): Promise<string> {
      return JSON.stringify([
        { text: 'Quote one here.' },
        { text: 'Quote two here.' },
        { text: 'Quote three here.' },
      ])
    }
  }
  test('returns 3 quotes with timestamps', async () => {
    __setChatProviderForTest(new MockChat())
    try {
      const transcript = '[00:00] Intro.\n[00:15] Quote one here.\n[00:30] Quote two here.\n[00:45] Quote three here.'
      const quotes = await extractQuotes(transcript)
      expect(quotes).toHaveLength(3)
      expect(quotes[0].text).toBe('Quote one here.')
      expect(quotes[0].timestampSec).toBe(15)
      expect(quotes[1].timestampSec).toBe(30)
      expect(quotes[2].timestampSec).toBe(45)
    } finally {
      __setChatProviderForTest(null)
    }
  })
})
