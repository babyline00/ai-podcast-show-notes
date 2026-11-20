import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { detectChapters, estimateDurationSec } from '@/lib/chapter-detector'
import { extractQuotes } from '@/lib/quote-extractor'
import { buildBios } from '@/lib/bio-builder'
import { buildTweetThread } from '@/lib/tweet-builder'
import { extractSeoTags } from '@/lib/seo-tags'
import { parseGuestBios } from '@/lib/types'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  try {
    const episode = await db.episode.findUnique({ where: { id } })
    if (!episode) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
    return NextResponse.json(episode)
  } catch (e) {
    console.error('[GET /api/episodes/[id]]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  try {
    const body = await req.json().catch(() => ({}))
    const episode = await db.episode.findUnique({ where: { id } })
    if (!episode) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}

    if (typeof body.title === 'string' && body.title.trim()) {
      updates.title = body.title.trim()
    }
    if (typeof body.podcastName === 'string') {
      updates.podcastName = body.podcastName.trim() || null
    }
    if (typeof body.transcript === 'string') {
      updates.transcript = body.transcript
      // Re-run chapter detection on the new transcript (pure-function, cheap)
      const chapters = detectChapters(body.transcript)
      updates.chapters = JSON.stringify(chapters)
      const durationSec = estimateDurationSec(body.transcript)
      if (durationSec !== null) updates.durationSec = durationSec
    }

    // If the caller asked for a full LLM regeneration, re-run everything
    // (uses the new transcript if one was provided, else the existing one).
    const regenerateLLM = body.regenerateLLM === true
    if (regenerateLLM) {
      const transcript = (updates.transcript as string) || episode.transcript
      const title = (updates.title as string) || episode.title
      const podcastName =
        (updates.podcastName as string | null) ?? episode.podcastName

      const [quotes, guestBios, tweetThread] = await Promise.all([
        extractQuotes(transcript),
        // Re-use existing guest names; if caller provided new ones, use those.
        buildBios(
          Array.isArray(body.guestNames)
            ? body.guestNames.filter((n: unknown): n is string => typeof n === 'string' && n.trim().length > 0)
            : parseGuestBios(episode).map((b) => b.name),
        ),
        buildTweetThread({ title, podcastName }, transcript),
      ])
      updates.quotes = JSON.stringify(quotes)
      updates.guestBios = JSON.stringify(guestBios)
      updates.tweetThread = JSON.stringify(tweetThread)
      updates.seoTags = JSON.stringify(extractSeoTags(transcript))
    }

    const updated = await db.episode.update({
      where: { id },
      data: updates,
    })
    return NextResponse.json(updated)
  } catch (e) {
    console.error('[PATCH /api/episodes/[id]]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  try {
    const episode = await db.episode.findUnique({ where: { id } })
    if (!episode) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }
    await db.episode.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /api/episodes/[id]]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
