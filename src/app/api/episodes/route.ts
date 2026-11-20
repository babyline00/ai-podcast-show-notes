import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { db } from '@/lib/db'
import { detectChapters, estimateDurationSec } from '@/lib/chapter-detector'
import { extractQuotes } from '@/lib/quote-extractor'
import { buildBios } from '@/lib/bio-builder'
import { buildTweetThread } from '@/lib/tweet-builder'
import { extractSeoTags } from '@/lib/seo-tags'

/**
 * MVP mock transcriber. The README documents that real transcription needs
 * `zai.audio.asr.create` which requires the audio in base64 — for the MVP
 * we surface a placeholder transcript and ask the user to paste the real
 * transcript for production use.
 */
function mockTranscribe(filename: string): string {
  return [
    `[00:00] [mock transcription] This is a placeholder transcript for ${filename}.`,
    `[00:18] [mock transcription] Real transcription requires the z-ai-web-dev-sdk ASR API.`,
    `[00:36] [mock transcription] For production use, please paste the real transcript.`,
  ].join('\n')
}

const AUDIO_EXT_RE = /\.(mp3|wav|m4a|aac|ogg|flac|opus|webm)$/i

export async function GET() {
  try {
    const episodes = await db.episode.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(episodes)
  } catch (e) {
    console.error('[GET /api/episodes]', e)
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const title = String(formData.get('title') || '').trim()
    const podcastName = String(formData.get('podcastName') || '').trim() || null
    const transcriptField = String(formData.get('transcript') || '')
    const guestNamesRaw = String(formData.get('guestNames') || '')
    const guestNames = guestNamesRaw
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)

    if (!title) {
      return NextResponse.json(
        { error: 'title is required' },
        { status: 400 },
      )
    }

    let transcript = transcriptField
    let audioPath: string | null = null

    const audioEntry = formData.get('audio')
    if (audioEntry && audioEntry instanceof File && audioEntry.size > 0) {
      const ext = (audioEntry.name.match(AUDIO_EXT_RE)?.[1] || 'audio').toLowerCase()
      const uuid = crypto.randomUUID()
      const filename = `${uuid}.${ext}`
      const uploadDir = path.join(process.cwd(), 'public', 'uploads')
      await fs.mkdir(uploadDir, { recursive: true })
      const buffer = Buffer.from(await audioEntry.arrayBuffer())
      await fs.writeFile(path.join(uploadDir, filename), buffer)
      audioPath = `/uploads/${filename}`

      // If the user did not paste a transcript, use the mock transcriber
      // so the episode is still demoable end-to-end.
      if (!transcript) {
        transcript = mockTranscribe(audioEntry.name)
      }
    }

    if (!transcript) {
      return NextResponse.json(
        { error: 'transcript or audio file is required' },
        { status: 400 },
      )
    }

    // 1) Pure-function chapter detection (synchronous)
    const chapters = detectChapters(transcript)
    const durationSec = estimateDurationSec(transcript)

    // 2) LLM calls (run sequentially so a single slow request can't pile up).
    const [quotes, guestBios, tweetThread] = await Promise.all([
      extractQuotes(transcript),
      buildBios(guestNames),
      buildTweetThread({ title, podcastName }, transcript),
    ])

    // 3) Pure-function SEO tags
    const seoTags = extractSeoTags(transcript)

    const episode = await db.episode.create({
      data: {
        title,
        podcastName,
        audioPath,
        transcript,
        chapters: JSON.stringify(chapters),
        quotes: JSON.stringify(quotes),
        guestBios: JSON.stringify(guestBios),
        tweetThread: JSON.stringify(tweetThread),
        seoTags: JSON.stringify(seoTags),
        durationSec,
        status: 'ready',
      },
    })

    return NextResponse.json(episode)
  } catch (e) {
    console.error('[POST /api/episodes]', e)
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    )
  }
}
