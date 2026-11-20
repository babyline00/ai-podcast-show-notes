import { test, expect, describe } from 'bun:test'
import { formatShowNotes, formatTime, formatDuration } from '../show-notes-formatter'
import type { Episode } from '../types'

function makeEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    id: 'ep-1',
    title: 'The Builders Podcast — Ep 42',
    podcastName: 'The Builders',
    audioPath: null,
    transcript: '[00:00] Welcome to the show.',
    chapters: JSON.stringify([
      { startSec: 0, endSec: 30, title: 'Welcome to the show' },
      { startSec: 30, endSec: 120, title: 'The future of AI podcasting' },
    ]),
    quotes: JSON.stringify([
      { text: 'The best way to predict the future is to invent it.', timestampSec: 12 },
      { text: 'Simplicity is the ultimate sophistication.', timestampSec: 45 },
    ]),
    guestBios: JSON.stringify([
      { name: 'Alice Lee', bio: 'Alice is a software engineer at Acme known for AI tooling.' },
      { name: 'Bob Chen', bio: 'Bob is a podcast producer known for audio editing tutorials.' },
    ]),
    tweetThread: JSON.stringify([
      { kind: 'hook', text: 'New episode dropped: three things I learned about AI podcasting.' },
      { kind: 'followup', text: 'First — transcripts unlock searchability.' },
      { kind: 'followup', text: 'Second — chapter markers drive retention.' },
    ]),
    seoTags: JSON.stringify(['podcasting', 'ai', 'transcription', 'chapters', 'quotes']),
    durationSec: 3600,
    status: 'ready',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  }
}

describe('formatShowNotes — overall structure', () => {
  test('starts with the episode title as H1', () => {
    const md = formatShowNotes(makeEpisode())
    expect(md.startsWith('# The Builders Podcast — Ep 42')).toBe(true)
  })

  test('includes podcast name + duration metadata', () => {
    const md = formatShowNotes(makeEpisode())
    expect(md).toContain('**Podcast:** The Builders')
    expect(md).toContain('**Duration:**')
  })

  test('omits podcast metadata when absent', () => {
    const md = formatShowNotes(makeEpisode({ podcastName: null, durationSec: null }))
    expect(md).not.toContain('**Podcast:**')
    expect(md).not.toContain('**Duration:**')
  })
})

describe('formatShowNotes — sections present', () => {
  test('contains a chapters list section', () => {
    const md = formatShowNotes(makeEpisode())
    expect(md).toContain('## Chapters')
    expect(md).toContain('Welcome to the show')
    expect(md).toContain('The future of AI podcasting')
  })

  test('contains a key quotes section with timestamps', () => {
    const md = formatShowNotes(makeEpisode())
    expect(md).toContain('## Key quotes')
    expect(md).toContain('predict the future')
    expect(md).toContain('Simplicity')
  })

  test('contains a guest bios section', () => {
    const md = formatShowNotes(makeEpisode())
    expect(md).toContain('## Guest bios')
    expect(md).toContain('Alice Lee')
    expect(md).toContain('Bob Chen')
  })

  test('contains a tweet thread section', () => {
    const md = formatShowNotes(makeEpisode())
    expect(md).toContain('## Tweet thread')
    expect(md).toContain('1/')
    expect(md).toContain('New episode dropped')
  })

  test('contains an SEO tags section', () => {
    const md = formatShowNotes(makeEpisode())
    expect(md).toContain('## SEO tags')
    expect(md).toContain('#podcasting')
    expect(md).toContain('#ai')
  })
})

describe('formatShowNotes — graceful with empty sections', () => {
  test('omits a section when its JSON is empty', () => {
    const ep = makeEpisode({
      chapters: '[]',
      quotes: '[]',
      guestBios: '[]',
      tweetThread: '[]',
      seoTags: '[]',
    })
    const md = formatShowNotes(ep)
    expect(md).not.toContain('## Chapters')
    expect(md).not.toContain('## Key quotes')
    expect(md).not.toContain('## Guest bios')
    expect(md).not.toContain('## Tweet thread')
    expect(md).not.toContain('## SEO tags')
    // But the title is still there
    expect(md).toContain('# The Builders Podcast — Ep 42')
  })

  test('handles malformed JSON gracefully (no crash)', () => {
    const ep = makeEpisode({ chapters: 'not-json', quotes: 'not-json' })
    expect(() => formatShowNotes(ep)).not.toThrow()
    const md = formatShowNotes(ep)
    expect(md).toContain('# The Builders Podcast — Ep 42')
  })
})

describe('formatTime / formatDuration helpers', () => {
  test('formatTime zero-pads minutes and seconds', () => {
    expect(formatTime(0)).toBe('00:00')
    expect(formatTime(5)).toBe('00:05')
    expect(formatTime(65)).toBe('01:05')
    expect(formatTime(3661)).toBe('61:01')
  })

  test('formatDuration formats as h m s when ≥ 1h', () => {
    expect(formatDuration(3661)).toBe('1h 1m 1s')
    expect(formatDuration(60)).toBe('1m 0s')
    expect(formatDuration(125)).toBe('2m 5s')
  })
})
