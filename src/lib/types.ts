/**
 * Shared types between the API route handlers and the show-notes formatter.
 * The Episode type mirrors the Prisma `Episode` model exactly so the
 * formatter can be called from both server and client code without import
 * cycles.
 */

export interface Chapter {
  startSec: number
  endSec: number
  title?: string
}

export interface Quote {
  text: string
  timestampSec: number
}

export interface GuestBio {
  name: string
  bio: string
}

export interface Tweet {
  kind: 'hook' | 'followup'
  text: string
}

export interface Episode {
  id: string
  title: string
  podcastName?: string | null
  audioPath?: string | null
  transcript: string
  chapters: string // JSON array of Chapter
  quotes: string // JSON array of Quote
  guestBios: string // JSON array of GuestBio
  tweetThread: string // JSON array of Tweet
  seoTags: string // JSON array of string
  durationSec?: number | null
  status: string
  createdAt: string | Date
  updatedAt: string | Date
}

/** Helpers to (de)serialize the JSON-encoded Episode fields safely. */
export function parseChapters(episode: Pick<Episode, 'chapters'>): Chapter[] {
  try {
    const parsed = JSON.parse(episode.chapters || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function parseQuotes(episode: Pick<Episode, 'quotes'>): Quote[] {
  try {
    const parsed = JSON.parse(episode.quotes || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function parseGuestBios(episode: Pick<Episode, 'guestBios'>): GuestBio[] {
  try {
    const parsed = JSON.parse(episode.guestBios || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function parseTweetThread(episode: Pick<Episode, 'tweetThread'>): Tweet[] {
  try {
    const parsed = JSON.parse(episode.tweetThread || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function parseSeoTags(episode: Pick<Episode, 'seoTags'>): string[] {
  try {
    const parsed = JSON.parse(episode.seoTags || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
