import { test, expect, describe } from 'bun:test'
import {
  detectChapters,
  firstSentenceTruncated,
  hasTimestamps,
  parseCaptions,
  estimateDurationSec,
} from '../chapter-detector'

describe('detectChapters — gap > 5s splits', () => {
  test('two captions 8s apart split into 2 chapters', () => {
    const transcript = '[00:00] Welcome to the show.\n[00:08] Now a totally different topic.'
    const chapters = detectChapters(transcript)
    expect(chapters).toHaveLength(2)
    expect(chapters[0].startSec).toBe(0)
    expect(chapters[1].startSec).toBe(8)
  })

  test('two captions 3s apart stay in 1 chapter', () => {
    const transcript = '[00:00] Hello.\n[00:03] World.'
    const chapters = detectChapters(transcript)
    expect(chapters).toHaveLength(1)
    expect(chapters[0].startSec).toBe(0)
  })
})

describe('detectChapters — paragraph breaks split', () => {
  test('plain transcript splits on blank lines', () => {
    const transcript = 'First paragraph about apples.\n\nSecond paragraph about oranges.\n\nThird paragraph about grapes.'
    const chapters = detectChapters(transcript)
    expect(chapters).toHaveLength(3)
    expect(chapters[0].title).toContain('apples')
    expect(chapters[1].title).toContain('oranges')
    expect(chapters[2].title).toContain('grapes')
  })

  test('timestamped transcript with paragraph break between markers splits', () => {
    const transcript = '[00:00] Topic one intro.\n\n[00:02] Topic two intro.'
    const chapters = detectChapters(transcript)
    expect(chapters).toHaveLength(2)
  })
})

describe('detectChapters — title is first 8 words', () => {
  test('title is first sentence truncated to 8 words', () => {
    const longTitle = 'The quick brown fox jumps over the lazy dog while the cat watches intently from afar.'
    const transcript = `[00:00] ${longTitle}\n[00:10] Next topic.`
    const chapters = detectChapters(transcript)
    expect(chapters[0].title).toBe('The quick brown fox jumps over the lazy')
    // 8 words exactly
    expect(chapters[0].title!.split(' ')).toHaveLength(8)
  })

  test('short first sentence uses the whole sentence as title', () => {
    const transcript = '[00:00] Short intro.\n[00:30] More content here.'
    const chapters = detectChapters(transcript)
    expect(chapters[0].title).toBe('Short intro.')
  })
})

describe('detectChapters — very short transcript returns 1 chapter', () => {
  test('one line, no timestamps returns a single chapter', () => {
    const chapters = detectChapters('Hello world this is a podcast.')
    expect(chapters).toHaveLength(1)
    expect(chapters[0].startSec).toBe(0)
    expect(chapters[0].title).toContain('Hello')
  })

  test('empty transcript returns empty array', () => {
    expect(detectChapters('')).toEqual([])
    expect(detectChapters('   \n  ')).toEqual([])
  })
})

describe('firstSentenceTruncated', () => {
  test('truncates to N words', () => {
    expect(firstSentenceTruncated('one two three four five six', 3)).toBe('one two three')
  })
  test('handles missing punctuation', () => {
    expect(firstSentenceTruncated('just some words', 8)).toBe('just some words')
  })
  test('handles empty input', () => {
    expect(firstSentenceTruncated('', 8)).toBe('')
  })
})

describe('hasTimestamps / parseCaptions / estimateDurationSec', () => {
  test('hasTimestamps detects [MM:SS]', () => {
    expect(hasTimestamps('[00:12] hi')).toBe(true)
    expect(hasTimestamps('no timestamps here')).toBe(false)
  })
  test('hasTimestamps detects [HH:MM:SS]', () => {
    expect(hasTimestamps('[01:02:33] hi')).toBe(true)
  })
  test('parseCaptions extracts startSec + text', () => {
    const c = parseCaptions('[00:30] hello world')
    expect(c).toHaveLength(1)
    expect(c[0].startSec).toBe(30)
    expect(c[0].text).toBe('hello world')
  })
  test('parseCaptions handles HH:MM:SS', () => {
    const c = parseCaptions('[01:02:03] long form')
    expect(c[0].startSec).toBe(1 * 3600 + 2 * 60 + 3)
  })
  test('estimateDurationSec returns max timestamp', () => {
    expect(estimateDurationSec('[00:00] a\n[00:30] b\n[02:15] c')).toBe(135)
  })
  test('estimateDurationSec returns null when no timestamps', () => {
    expect(estimateDurationSec('plain text no markers')).toBeNull()
  })
})
