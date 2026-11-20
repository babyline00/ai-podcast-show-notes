import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { detectChapters } from '@/lib/chapter-detector'
import { extractQuotes } from '@/lib/quote-extractor'
import { buildBios } from '@/lib/bio-builder'
import { buildTweetThread } from '@/lib/tweet-builder'
import { extractSeoTags } from '@/lib/seo-tags'
import { parseGuestBios } from '@/lib/types'

type Section = 'chapters' | 'quotes' | 'bios' | 'tweets' | 'seoTags'

const VALID_SECTIONS: Section[] = ['chapters', 'quotes', 'bios', 'tweets', 'seoTags']

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  try {
    const body = await req.json().catch(() => ({}))
    const section = body?.section as Section
    if (!VALID_SECTIONS.includes(section)) {
      return NextResponse.json(
        { error: `invalid section; expected one of ${VALID_SECTIONS.join(', ')}` },
        { status: 400 },
      )
    }

    const episode = await db.episode.findUnique({ where: { id } })
    if (!episode) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    const transcript = episode.transcript

    switch (section) {
      case 'chapters': {
        const chapters = detectChapters(transcript)
        await db.episode.update({
          where: { id },
          data: { chapters: JSON.stringify(chapters) },
        })
        break
      }
      case 'quotes': {
        const quotes = await extractQuotes(transcript)
        await db.episode.update({
          where: { id },
          data: { quotes: JSON.stringify(quotes) },
        })
        break
      }
      case 'bios': {
        const names = parseGuestBios(episode).map((b) => b.name)
        const bios = await buildBios(names)
        await db.episode.update({
          where: { id },
          data: { guestBios: JSON.stringify(bios) },
        })
        break
      }
      case 'tweets': {
        const tweets = await buildTweetThread(
          { title: episode.title, podcastName: episode.podcastName },
          transcript,
        )
        await db.episode.update({
          where: { id },
          data: { tweetThread: JSON.stringify(tweets) },
        })
        break
      }
      case 'seoTags': {
        const tags = extractSeoTags(transcript)
        await db.episode.update({
          where: { id },
          data: { seoTags: JSON.stringify(tags) },
        })
        break
      }
    }

    const updated = await db.episode.findUnique({ where: { id } })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('[POST /api/episodes/[id]/regenerate]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
