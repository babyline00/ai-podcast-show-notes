import { test, expect, describe } from 'bun:test'
import {
  buildTweetPrompt,
  parseTweetsResponse,
  buildTweetThread,
  TWEET_MAX_CHARS,
} from '../tweet-builder'
import { __setChatProviderForTest, type ChatProvider } from '../ai'

describe('buildTweetPrompt', () => {
  test('asks for a 3-tweet thread (hook + 2 follow-ups)', () => {
    const p = buildTweetPrompt({ title: 'Ep 1' }, 'transcript')
    expect(p.toLowerCase()).toContain('tweet')
    expect(p).toContain('hook')
    expect(p.toLowerCase()).toContain('follow')
  })
  test('enforces 280 char limit in the prompt', () => {
    const p = buildTweetPrompt({ title: 'Ep 1' }, 'transcript')
    expect(p).toContain('280')
  })
  test('includes the episode title', () => {
    const p = buildTweetPrompt({ title: 'My Episode 42' }, 'transcript')
    expect(p).toContain('My Episode 42')
  })
  test('includes the podcast name when provided', () => {
    const p = buildTweetPrompt({ title: 'Ep', podcastName: 'The Builders' }, 'transcript')
    expect(p).toContain('The Builders')
  })
})

describe('parseTweetsResponse', () => {
  test('parses valid JSON array of 3 tweets', () => {
    const text = JSON.stringify([
      { kind: 'hook', text: 'Hook tweet.' },
      { kind: 'followup', text: 'Followup one.' },
      { kind: 'followup', text: 'Followup two.' },
    ])
    const tweets = parseTweetsResponse(text)
    expect(tweets).toHaveLength(3)
    expect(tweets[0].kind).toBe('hook')
    expect(tweets[1].kind).toBe('followup')
    expect(tweets[2].kind).toBe('followup')
  })

  test('truncates tweets longer than 280 chars', () => {
    const long = 'x'.repeat(300)
    const text = JSON.stringify([
      { kind: 'hook', text: long },
      { kind: 'followup', text: 'short' },
      { kind: 'followup', text: 'short' },
    ])
    const tweets = parseTweetsResponse(text)
    expect(tweets[0].text.length).toBe(TWEET_MAX_CHARS)
    expect(tweets[1].text).toBe('short')
  })

  test('caps at 3 tweets even if LLM returns more', () => {
    const text = JSON.stringify([
      { kind: 'hook', text: 'one' },
      { kind: 'followup', text: 'two' },
      { kind: 'followup', text: 'three' },
      { kind: 'followup', text: 'four' },
      { kind: 'followup', text: 'five' },
    ])
    expect(parseTweetsResponse(text)).toHaveLength(3)
  })

  test('first tweet always tagged hook, rest followup', () => {
    const text = JSON.stringify([
      { kind: 'whatever', text: 'one' },
      { kind: 'whatever', text: 'two' },
      { kind: 'whatever', text: 'three' },
    ])
    const tweets = parseTweetsResponse(text)
    expect(tweets[0].kind).toBe('hook')
    expect(tweets[1].kind).toBe('followup')
    expect(tweets[2].kind).toBe('followup')
  })

  test('drops tweets with empty text', () => {
    const text = JSON.stringify([
      { kind: 'hook', text: '' },
      { kind: 'followup', text: 'real tweet' },
      { kind: 'followup', text: '   ' },
    ])
    const tweets = parseTweetsResponse(text)
    expect(tweets).toHaveLength(1)
    expect(tweets[0].text).toBe('real tweet')
  })

  test('gracefully handles malformed JSON', () => {
    expect(parseTweetsResponse('not json')).toEqual([])
  })

  test('extracts JSON array from prose wrapper', () => {
    const text = `Here you go:\n[{"kind":"hook","text":"a"},{"kind":"followup","text":"b"},{"kind":"followup","text":"c"}]`
    const tweets = parseTweetsResponse(text)
    expect(tweets).toHaveLength(3)
  })
})

describe('buildTweetThread (end-to-end via MockProvider)', () => {
  class MockChat implements ChatProvider {
    async complete(): Promise<string> {
      return JSON.stringify([
        { kind: 'hook', text: 'Hook tweet about AI podcasting.' },
        { kind: 'followup', text: 'Follow-up about transcripts.' },
        { kind: 'followup', text: 'Follow-up about chapter markers.' },
      ])
    }
  }
  test('returns 3 deterministic tweets', async () => {
    __setChatProviderForTest(new MockChat())
    try {
      const tweets = await buildTweetThread({ title: 'Ep 1' }, 'transcript text')
      expect(tweets).toHaveLength(3)
      expect(tweets[0].text).toBe('Hook tweet about AI podcasting.')
      expect(tweets[1].text).toBe('Follow-up about transcripts.')
      expect(tweets[2].text).toBe('Follow-up about chapter markers.')
    } finally {
      __setChatProviderForTest(null)
    }
  })
})
