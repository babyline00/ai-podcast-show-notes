import { test, expect, describe } from 'bun:test'
import {
  __setChatProviderForTest,
  getChatProvider,
  MockProvider,
  type ChatProvider,
} from '../ai'
import { extractQuotes } from '../quote-extractor'
import { buildBios } from '../bio-builder'
import { buildTweetThread } from '../tweet-builder'

/**
 * The MockProvider is exported so the test suite (and offline demo runs)
 * can assert deterministic outputs from all three LLM-driven sections
 * without touching the network.
 */
describe('MockProvider — deterministic outputs', () => {
  test('returns deterministic quotes when prompt asks for quotable sentences', async () => {
    const p = new MockProvider()
    const out = await p.complete({
      systemPrompt: 'you are an editor',
      userPrompt: 'extract the most quotable sentences from this transcript: ...',
    })
    const parsed = JSON.parse(out)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBeGreaterThanOrEqual(3)
    expect(parsed.length).toBeLessThanOrEqual(5)
    for (const q of parsed) {
      expect(typeof q.text).toBe('string')
      expect(q.text.length).toBeGreaterThan(0)
    }
  })

  test('returns a deterministic bio when prompt asks for a guest bio', async () => {
    const p = new MockProvider()
    const out = await p.complete({
      systemPrompt: 'you are a producer',
      userPrompt: 'Write a 1-2 sentence bio for guest "Alice".',
    })
    expect(typeof out).toBe('string')
    expect(out.toLowerCase()).toContain('software engineer')
  })

  test('returns a deterministic tweet thread when prompt asks for tweets', async () => {
    const p = new MockProvider()
    const out = await p.complete({
      systemPrompt: 'you are a podcast marketer',
      userPrompt: 'Write a 3-tweet thread about this episode.',
    })
    const parsed = JSON.parse(out)
    expect(parsed).toHaveLength(3)
    expect(parsed[0].kind).toBe('hook')
    expect(parsed[1].kind).toBe('followup')
    expect(parsed[2].kind).toBe('followup')
    for (const t of parsed) {
      expect(t.text.length).toBeLessThanOrEqual(280)
    }
  })

  test('returns empty string for unknown prompt shape', async () => {
    const p = new MockProvider()
    const out = await p.complete({
      systemPrompt: 'sys',
      userPrompt: 'unrelated prompt with no keywords',
    })
    expect(out).toBe('')
  })
})

describe('getChatProvider — injectable via __setChatProviderForTest', () => {
  test('returns the injected provider instance', () => {
    class CustomMock implements ChatProvider {
      async complete(): Promise<string> {
        return 'custom response'
      }
    }
    const custom = new CustomMock()
    __setChatProviderForTest(custom)
    try {
      expect(getChatProvider()).toBe(custom)
    } finally {
      __setChatProviderForTest(null)
    }
  })

  test('resets to a fresh provider when null is injected', () => {
    __setChatProviderForTest(new MockProvider())
    __setChatProviderForTest(null)
    const p = getChatProvider()
    expect(typeof p.complete).toBe('function')
  })
})

describe('End-to-end pipeline via MockProvider (quotes + bios + tweets)', () => {
  // Use the built-in MockProvider so all three extractors get the canned,
  // deterministic outputs.
  test('extractQuotes returns 4 mock quotes', async () => {
    __setChatProviderForTest(new MockProvider())
    try {
      const quotes = await extractQuotes('[00:00] intro.\n[00:30] the future is here.')
      expect(quotes.length).toBeGreaterThanOrEqual(3)
      expect(quotes.length).toBeLessThanOrEqual(5)
      expect(quotes[0].text).toContain('future')
    } finally {
      __setChatProviderForTest(null)
    }
  })

  test('buildBios returns mock bio with "software engineer"', async () => {
    __setChatProviderForTest(new MockProvider())
    try {
      const bios = await buildBios(['Alice'])
      expect(bios).toHaveLength(1)
      expect(bios[0].name).toBe('Alice')
      expect(bios[0].bio.toLowerCase()).toContain('software engineer')
    } finally {
      __setChatProviderForTest(null)
    }
  })

  test('buildTweetThread returns 3 mock tweets (hook + 2 follow-ups)', async () => {
    __setChatProviderForTest(new MockProvider())
    try {
      const tweets = await buildTweetThread({ title: 'Ep 1' }, 'transcript text')
      expect(tweets).toHaveLength(3)
      expect(tweets[0].kind).toBe('hook')
      expect(tweets[1].kind).toBe('followup')
      expect(tweets[2].kind).toBe('followup')
    } finally {
      __setChatProviderForTest(null)
    }
  })

  test('all three sections share one injected provider instance', async () => {
    let calls = 0
    class CountingMock implements ChatProvider {
      async complete(): Promise<string> {
        calls++
        return '[]'
      }
    }
    __setChatProviderForTest(new CountingMock())
    try {
      await extractQuotes('transcript')
      await buildBios(['Alice'])
      await buildTweetThread({ title: 'Ep' }, 'transcript')
      expect(calls).toBe(3) // one complete() per LLM-driven section
    } finally {
      __setChatProviderForTest(null)
    }
  })
})
