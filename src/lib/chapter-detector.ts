/**
 * Chapter detection for podcast transcripts.
 *
 * The transcript may or may not have inline timestamp markers. Two modes:
 *
 *  - Timestamped: captions look like `[00:12] Hello world` or
 *    `[01:02:33] Hello world`. A new chapter opens when (a) the gap between
 *    adjacent captions is > 5 seconds, OR (b) there is a blank line
 *    (paragraph break) in the raw transcript between the two markers.
 *
 *  - Plain (no timestamps): the transcript is split on paragraph breaks
 *    (`\n\n`). Each paragraph becomes one chapter with virtual 60-second
 *    timestamps so the UI still has something to render.
 *
 * The chapter `title` is the first sentence of the chapter, truncated to
 * 8 words. A chapter with fewer than 8 words in its opening sentence uses
 * the whole sentence as the title.
 */

import type { Chapter } from './types'

const TIMESTAMP_RE = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/

interface Caption {
  startSec: number
  text: string
  rawPos: number // index in the raw transcript
}

export function hasTimestamps(transcript: string): boolean {
  return TIMESTAMP_RE.test(transcript)
}

/** Parses `transcript` into a list of captions with absolute second offsets. */
export function parseCaptions(transcript: string): Caption[] {
  const captions: Caption[] = []
  const re = new RegExp(TIMESTAMP_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(transcript)) !== null) {
    const startSec = parseSecondsFromMatch(m)
    const lineEnd = transcript.indexOf('\n', m.index)
    const after = transcript.slice(
      m.index + m[0].length,
      lineEnd === -1 ? undefined : lineEnd,
    )
    captions.push({ startSec, text: after.trim(), rawPos: m.index })
  }
  return captions
}

function parseSecondsFromMatch(m: RegExpExecArray | RegExpMatchArray): number {
  const a = parseInt(m[1], 10)
  const b = parseInt(m[2], 10)
  if (m[3] !== undefined) {
    // [HH:MM:SS]
    return a * 3600 + b * 60 + parseInt(m[3], 10)
  }
  // [MM:SS]
  return a * 60 + b
}

/**
 * Returns the largest timestamp in the transcript, used as a duration
 * estimate. Returns null when the transcript has no timestamps.
 */
export function estimateDurationSec(transcript: string): number | null {
  const re = new RegExp(TIMESTAMP_RE.source, 'g')
  let m: RegExpExecArray | null
  let maxSec = 0
  let found = false
  while ((m = re.exec(transcript)) !== null) {
    found = true
    const sec = parseSecondsFromMatch(m)
    if (sec > maxSec) maxSec = sec
  }
  return found ? maxSec : null
}

/**
 * Truncates the first sentence of `text` to `maxWords` words. A sentence
 * ends at `.`, `!`, `?`, or the first newline.
 */
export function firstSentenceTruncated(text: string, maxWords: number): string {
  if (!text) return ''
  const sentenceMatch = text.match(/^[^.!?\n]+[.!?]?/)
  const sentence = (sentenceMatch ? sentenceMatch[0] : text).trim()
  const words = sentence.split(/\s+/).filter(Boolean).slice(0, maxWords)
  return words.join(' ')
}

/**
 * Detects chapters in the transcript. Always returns at least one chapter
 * when the transcript is non-empty.
 */
export function detectChapters(transcript: string): Chapter[] {
  if (!transcript || !transcript.trim()) return []

  if (hasTimestamps(transcript)) {
    const tsChapters = detectChaptersTimestamped(transcript)
    if (tsChapters.length > 0) return tsChapters
  }

  return detectChaptersPlain(transcript)
}

function detectChaptersTimestamped(transcript: string): Chapter[] {
  const captions = parseCaptions(transcript)
  if (captions.length === 0) return []

  const splits: number[] = [] // caption indices that START a new chapter
  for (let i = 1; i < captions.length; i++) {
    const prev = captions[i - 1]
    const curr = captions[i]
    const gap = curr.startSec - prev.startSec
    if (gap > 5) {
      splits.push(i)
      continue
    }
    // Paragraph break between prev and curr?
    const segment = transcript.slice(prev.rawPos, curr.rawPos)
    if (/\n\s*\n/.test(segment)) {
      splits.push(i)
    }
  }

  const chapters: Chapter[] = []
  let startIdx = 0
  for (const splitIdx of splits) {
    const chunk = captions.slice(startIdx, splitIdx)
    chapters.push({
      startSec: chunk[0].startSec,
      endSec: chunk[chunk.length - 1].startSec,
      title: firstSentenceTruncated(chunk[0].text, 8),
    })
    startIdx = splitIdx
  }
  const last = captions.slice(startIdx)
  chapters.push({
    startSec: last[0].startSec,
    endSec: last[last.length - 1].startSec,
    title: firstSentenceTruncated(last[0].text, 8),
  })

  return chapters
}

function detectChaptersPlain(transcript: string): Chapter[] {
  const paragraphs = transcript
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (paragraphs.length <= 1) {
    return [
      {
        startSec: 0,
        endSec: 0,
        title: firstSentenceTruncated(transcript.trim(), 8),
      },
    ]
  }

  // Each paragraph becomes a chapter with virtual 60-second timestamps.
  return paragraphs.map((p, i) => ({
    startSec: i * 60,
    endSec: (i + 1) * 60,
    title: firstSentenceTruncated(p, 8),
  }))
}
