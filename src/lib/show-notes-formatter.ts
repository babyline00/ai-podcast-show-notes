/**
 * Show notes formatter — assembles all generated artifacts (chapters,
 * quotes, guest bios, tweet thread, SEO tags) into a single markdown
 * document that's ready to paste into a podcast CMS or show notes page.
 *
 * Pure function: takes an `Episode`, returns a string. No I/O, no LLM.
 */

import type { Episode } from './types'
import {
  parseChapters,
  parseQuotes,
  parseGuestBios,
  parseTweetThread,
  parseSeoTags,
} from './types'

export function formatShowNotes(episode: Episode): string {
  const chapters = parseChapters(episode)
  const quotes = parseQuotes(episode)
  const guestBios = parseGuestBios(episode)
  const tweetThread = parseTweetThread(episode)
  const seoTags = parseSeoTags(episode)

  const parts: string[] = []

  parts.push(`# ${episode.title}`)
  parts.push('')

  if (episode.podcastName) {
    parts.push(`**Podcast:** ${episode.podcastName}`)
  }
  if (episode.durationSec && episode.durationSec > 0) {
    parts.push(`**Duration:** ${formatDuration(episode.durationSec)}`)
  }
  if (episode.podcastName || episode.durationSec) parts.push('')

  if (chapters.length > 0) {
    parts.push('## Chapters')
    parts.push('')
    for (const c of chapters) {
      const title = c.title ? ` — ${c.title}` : ''
      parts.push(`- ${formatTime(c.startSec)}${title}`)
    }
    parts.push('')
  }

  if (quotes.length > 0) {
    parts.push('## Key quotes')
    parts.push('')
    for (const q of quotes) {
      parts.push(`> "${q.text}"`)
      parts.push(`> — at ${formatTime(q.timestampSec)}`)
      parts.push('')
    }
  }

  if (guestBios.length > 0) {
    parts.push('## Guest bios')
    parts.push('')
    for (const b of guestBios) {
      parts.push(`**${b.name}:** ${b.bio}`)
      parts.push('')
    }
  }

  if (tweetThread.length > 0) {
    parts.push('## Tweet thread')
    parts.push('')
    for (let i = 0; i < tweetThread.length; i++) {
      const t = tweetThread[i]
      parts.push(`${i + 1}/ ${t.text}`)
      parts.push('')
    }
  }

  if (seoTags.length > 0) {
    parts.push('## SEO tags')
    parts.push('')
    parts.push(seoTags.map((t) => `#${t.replace(/\s+/g, '')}`).join(' '))
    parts.push('')
  }

  return parts.join('\n').trim() + '\n'
}

export function formatTime(sec: number): string {
  const safe = Math.max(0, Math.floor(sec || 0))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatDuration(sec: number): string {
  const safe = Math.max(0, Math.floor(sec || 0))
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = safe % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}
