'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  Plus,
  Trash2,
  RefreshCw,
  Copy,
  Mic2,
  Clock,
  Hash,
  Quote as QuoteIcon,
  User,
  Twitter,
  FileAudio,
  Check,
} from 'lucide-react'
import { formatShowNotes, formatTime, formatDuration } from '@/lib/show-notes-formatter'
import type {
  Episode,
  Chapter,
  Quote,
  GuestBio,
  Tweet,
} from '@/lib/types'
import {
  parseChapters,
  parseQuotes,
  parseGuestBios,
  parseTweetThread,
  parseSeoTags,
} from '@/lib/types'

type Section = 'chapters' | 'quotes' | 'bios' | 'tweets' | 'seoTags'

export default function HomePage() {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Episode | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [creating, setCreating] = useState(false)
  const [regenerating, setRegenerating] = useState<Section | null>(null)
  const [savingTranscript, setSavingTranscript] = useState(false)
  const [draftTranscript, setDraftTranscript] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // New-episode form state
  const [formTitle, setFormTitle] = useState('')
  const [formPodcast, setFormPodcast] = useState('')
  const [formGuests, setFormGuests] = useState('')
  const [formTranscript, setFormTranscript] = useState('')
  const [formAudio, setFormAudio] = useState<File | null>(null)

  const listEndRef = useRef<HTMLDivElement | null>(null)

  const fetchEpisodes = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await fetch('/api/episodes')
      if (!res.ok) throw new Error('failed to load episodes')
      const data: Episode[] = await res.json()
      setEpisodes(data)
    } catch (e) {
      toast.error('Failed to load episodes', { description: (e as Error).message })
    } finally {
      setLoadingList(false)
    }
  }, [])

  const fetchEpisode = useCallback(async (id: string) => {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/episodes/${id}`)
      if (!res.ok) throw new Error('failed to load episode')
      const data: Episode = await res.json()
      setSelected(data)
      setDraftTranscript(data.transcript || '')
    } catch (e) {
      toast.error('Failed to load episode', { description: (e as Error).message })
      setSelected(null)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    fetchEpisodes()
  }, [fetchEpisodes])

  useEffect(() => {
    if (selectedId) fetchEpisode(selectedId)
    else {
      setSelected(null)
      setDraftTranscript('')
    }
  }, [selectedId, fetchEpisode])

  const resetForm = () => {
    setFormTitle('')
    setFormPodcast('')
    setFormGuests('')
    setFormTranscript('')
    setFormAudio(null)
  }

  const handleCreate = useCallback(async () => {
    if (!formTitle.trim()) {
      toast.error('Title is required')
      return
    }
    if (!formAudio && !formTranscript.trim()) {
      toast.error('Either an audio file or a transcript is required')
      return
    }
    setCreating(true)
    try {
      const fd = new FormData()
      fd.append('title', formTitle.trim())
      if (formPodcast.trim()) fd.append('podcastName', formPodcast.trim())
      if (formGuests.trim()) fd.append('guestNames', formGuests.trim())
      if (formTranscript.trim()) fd.append('transcript', formTranscript.trim())
      if (formAudio) fd.append('audio', formAudio, formAudio.name)

      const res = await fetch('/api/episodes', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'create failed' }))
        throw new Error(err.error || 'create failed')
      }
      const created: Episode = await res.json()
      toast.success('Episode created', { description: 'Show notes generated.' })
      resetForm()
      setShowNew(false)
      await fetchEpisodes()
      setSelectedId(created.id)
    } catch (e) {
      toast.error('Failed to create episode', { description: (e as Error).message })
    } finally {
      setCreating(false)
    }
  }, [formTitle, formPodcast, formGuests, formTranscript, formAudio, fetchEpisodes])

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id)
      try {
        const res = await fetch(`/api/episodes/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('delete failed')
        toast.success('Episode deleted')
        if (selectedId === id) setSelectedId(null)
        await fetchEpisodes()
      } catch (e) {
        toast.error('Failed to delete episode', { description: (e as Error).message })
      } finally {
        setDeletingId(null)
      }
    },
    [selectedId, fetchEpisodes],
  )

  const handleSaveTranscript = useCallback(async () => {
    if (!selected) return
    if (draftTranscript === selected.transcript) {
      toast.info('No changes to save')
      return
    }
    setSavingTranscript(true)
    try {
      const res = await fetch(`/api/episodes/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: draftTranscript,
          regenerateLLM: false,
        }),
      })
      if (!res.ok) throw new Error('save failed')
      await fetchEpisode(selected.id)
      toast.success('Transcript saved. Chapters re-detected.')
    } catch (e) {
      toast.error('Failed to save transcript', { description: (e as Error).message })
    } finally {
      setSavingTranscript(false)
    }
  }, [selected, draftTranscript, fetchEpisode])

  const handleRegenerate = useCallback(
    async (section: Section) => {
      if (!selected) return
      setRegenerating(section)
      try {
        const res = await fetch(`/api/episodes/${selected.id}/regenerate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'regenerate failed' }))
          throw new Error(err.error || 'regenerate failed')
        }
        await fetchEpisode(selected.id)
        toast.success(`${sectionLabel(section)} regenerated`)
      } catch (e) {
        toast.error('Failed to regenerate', { description: (e as Error).message })
      } finally {
        setRegenerating(null)
      }
    },
    [selected, fetchEpisode],
  )

  const handleCopyMarkdown = useCallback(async () => {
    if (!selected) return
    const md = formatShowNotes(selected)
    try {
      await navigator.clipboard.writeText(md)
      toast.success('Markdown copied to clipboard', {
        description: `${md.length} chars · ${md.split('\n').length} lines`,
      })
    } catch {
      // Fallback: download
      const blob = new Blob([md], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selected.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Markdown downloaded')
    }
  }, [selected])

  const chapters = useMemo<Chapter[]>(() => (selected ? parseChapters(selected) : []), [selected])
  const quotes = useMemo<Quote[]>(() => (selected ? parseQuotes(selected) : []), [selected])
  const guestBios = useMemo<GuestBio[]>(() => (selected ? parseGuestBios(selected) : []), [selected])
  const tweetThread = useMemo<Tweet[]>(() => (selected ? parseTweetThread(selected) : []), [selected])
  const seoTags = useMemo<string[]>(() => (selected ? parseSeoTags(selected) : []), [selected])

  const draftWordCount = useMemo(
    () => draftTranscript.split(/\s+/).filter(Boolean).length,
    [draftTranscript],
  )

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Mic2 className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base md:text-lg font-semibold truncate">
                AI Podcast Show Notes Generator
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Chapters · quotes · guest bios · tweet thread · SEO tags — auto-generated from your transcript.
              </p>
            </div>
          </div>
          <Button onClick={() => setShowNew(true)} className="shrink-0">
            <Plus className="size-4" />
            New episode
          </Button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-[320px_1fr] min-h-0">
        {/* Episode list */}
        <aside className="border-r bg-card/40 flex flex-col min-h-0">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-medium text-muted-foreground">
              Episodes
              <span className="ml-2 text-xs">({episodes.length})</span>
            </h2>
          </div>
          <ScrollArea className="flex-1 max-h-[calc(100vh-180px)] scrollbar-thin">
            {loadingList ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-md" />
                ))}
              </div>
            ) : episodes.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                <Mic2 className="size-8 mx-auto mb-2 opacity-40" />
                No episodes yet. Click <span className="font-medium text-foreground">New episode</span> to start.
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {episodes.map((ep) => (
                  <div
                    key={ep.id}
                    className={`group relative p-3 rounded-md border transition-colors cursor-pointer ${
                      selectedId === ep.id
                        ? 'bg-accent border-accent-foreground/20'
                        : 'bg-card hover:bg-accent/50 border-transparent'
                    }`}
                    onClick={() => setSelectedId(ep.id)}
                  >
                    <div className="flex items-start justify-between gap-2 pr-6">
                      <span className="font-medium text-sm line-clamp-2 leading-tight">
                        {ep.title}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1.5 flex flex-wrap items-center gap-1.5">
                      {ep.podcastName && (
                        <span className="truncate max-w-[160px]">{ep.podcastName}</span>
                      )}
                      {ep.durationSec ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Clock className="size-3" />
                          {formatDuration(ep.durationSec)}
                        </span>
                      ) : null}
                      <Badge
                        variant={ep.status === 'ready' ? 'secondary' : 'outline'}
                        className="text-[10px] px-1 py-0"
                      >
                        {ep.status}
                      </Badge>
                    </div>
                    <button
                      type="button"
                      aria-label="Delete episode"
                      disabled={deletingId === ep.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(ep.id)
                      }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity size-6 inline-flex items-center justify-center rounded-md hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      {deletingId === ep.id ? (
                        <RefreshCw className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </button>
                  </div>
                ))}
                <div ref={listEndRef} />
              </div>
            )}
          </ScrollArea>
        </aside>

        {/* Episode detail */}
        <section className="min-h-0 flex flex-col">
          {!selectedId || !selected ? (
            <div className="h-full flex items-center justify-center p-8 text-center min-h-[60vh]">
              <div className="max-w-md">
                {loadingDetail ? (
                  <>
                    <Skeleton className="size-12 rounded-full mx-auto mb-4" />
                    <Skeleton className="h-6 w-48 mx-auto mb-2" />
                    <Skeleton className="h-4 w-72 mx-auto" />
                  </>
                ) : (
                  <>
                    <div className="size-14 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
                      <Mic2 className="size-7 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium text-base mb-1">
                      {episodes.length === 0 ? 'No episodes yet' : 'No episode selected'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {episodes.length === 0
                        ? 'Click "New episode" to upload audio and paste a transcript.'
                        : 'Pick an episode from the left to view its auto-generated show notes.'}
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1 max-h-[calc(100vh-180px)] scrollbar-thin">
              <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
                {/* Title + meta */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-xl md:text-2xl font-semibold leading-tight">
                      {selected.title}
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    {selected.podcastName && (
                      <Badge variant="outline">{selected.podcastName}</Badge>
                    )}
                    {selected.durationSec ? (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="size-3" />
                        {formatDuration(selected.durationSec)}
                      </Badge>
                    ) : null}
                    {selected.audioPath && (
                      <Badge variant="outline" className="gap-1">
                        <FileAudio className="size-3" />
                        audio attached
                      </Badge>
                    )}
                    <Badge
                      variant={selected.status === 'ready' ? 'secondary' : 'outline'}
                    >
                      {selected.status}
                    </Badge>
                  </div>
                </div>

                {/* Audio player */}
                {selected.audioPath && (
                  <audio
                    controls
                    src={selected.audioPath}
                    className="w-full"
                    preload="metadata"
                  />
                )}

                {/* Transcript editor */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Transcript</CardTitle>
                    <CardDescription>
                      Edit the transcript to fix transcription errors. Saving re-runs chapter detection but not the LLM calls.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      value={draftTranscript}
                      onChange={(e) => setDraftTranscript(e.target.value)}
                      rows={10}
                      placeholder="Paste the transcript here. Timestamps like [00:12] enable chapter detection."
                      className="font-mono text-xs leading-relaxed scrollbar-thin"
                    />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {draftWordCount} words
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSaveTranscript}
                        disabled={savingTranscript || draftTranscript === selected.transcript}
                      >
                        {savingTranscript ? (
                          <RefreshCw className="size-3.5 animate-spin" />
                        ) : (
                          <Check className="size-3.5" />
                        )}
                        Save transcript
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Separator />

                {/* Tabbed generated content */}
                <Tabs defaultValue="chapters" className="w-full">
                  <TabsList className="flex w-full overflow-x-auto">
                    <TabsTrigger value="chapters" className="gap-1.5">
                      <Hash className="size-3.5" />
                      <span className="hidden sm:inline">Chapters</span>
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                        {chapters.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="quotes" className="gap-1.5">
                      <QuoteIcon className="size-3.5" />
                      <span className="hidden sm:inline">Quotes</span>
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                        {quotes.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="bios" className="gap-1.5">
                      <User className="size-3.5" />
                      <span className="hidden sm:inline">Bios</span>
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                        {guestBios.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="tweets" className="gap-1.5">
                      <Twitter className="size-3.5" />
                      <span className="hidden sm:inline">Tweets</span>
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                        {tweetThread.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="seo" className="gap-1.5">
                      <Hash className="size-3.5" />
                      <span className="hidden sm:inline">SEO tags</span>
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                        {seoTags.length}
                      </Badge>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="chapters">
                    <SectionCard
                      title="Chapters"
                      description="Auto-detected at topic-shift boundaries (gap > 5s or paragraph break)."
                      onRegenerate={() => handleRegenerate('chapters')}
                      regenerating={regenerating === 'chapters'}
                    >
                      {chapters.length === 0 ? (
                        <EmptyHint text="No chapters detected. Add timestamp markers like [00:12] to your transcript." />
                      ) : (
                        <ol className="space-y-2">
                          {chapters.map((c, i) => (
                            <li
                              key={i}
                              className="flex gap-3 text-sm items-start"
                            >
                              <Badge variant="secondary" className="font-mono shrink-0 mt-0.5">
                                {formatTime(c.startSec)}
                              </Badge>
                              <span className="leading-relaxed">
                                {c.title || (
                                  <span className="text-muted-foreground italic">
                                    (untitled chapter)
                                  </span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </SectionCard>
                  </TabsContent>

                  <TabsContent value="quotes">
                    <SectionCard
                      title="Key quotes"
                      description="3-5 most quotable sentences, with timestamps estimated by string match against the transcript."
                      onRegenerate={() => handleRegenerate('quotes')}
                      regenerating={regenerating === 'quotes'}
                    >
                      {quotes.length === 0 ? (
                        <EmptyHint text="No quotes extracted. Click Regenerate to try again." />
                      ) : (
                        <ul className="space-y-3">
                          {quotes.map((q, i) => (
                            <li key={i} className="border-l-2 border-primary/40 pl-3">
                              <blockquote className="text-sm italic leading-relaxed">
                                &ldquo;{q.text}&rdquo;
                              </blockquote>
                              <div className="text-xs text-muted-foreground mt-1">
                                at {formatTime(q.timestampSec)}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </SectionCard>
                  </TabsContent>

                  <TabsContent value="bios">
                    <SectionCard
                      title="Guest bios"
                      description="1-2 sentence bios for each guest. Real bios need web search (a stretch goal)."
                      onRegenerate={() => handleRegenerate('bios')}
                      regenerating={regenerating === 'bios'}
                    >
                      {guestBios.length === 0 ? (
                        <EmptyHint text="No guests. Add guest names (semicolon-separated) when creating the episode." />
                      ) : (
                        <ul className="space-y-3">
                          {guestBios.map((b, i) => (
                            <li key={i}>
                              <div className="text-sm font-medium">{b.name}</div>
                              <div className="text-sm text-muted-foreground leading-relaxed mt-0.5">
                                {b.bio}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </SectionCard>
                  </TabsContent>

                  <TabsContent value="tweets">
                    <SectionCard
                      title="Tweet thread"
                      description="A 3-tweet thread: a hook plus two follow-ups, each ≤ 280 chars."
                      onRegenerate={() => handleRegenerate('tweets')}
                      regenerating={regenerating === 'tweets'}
                    >
                      {tweetThread.length === 0 ? (
                        <EmptyHint text="No tweets drafted. Click Regenerate to try again." />
                      ) : (
                        <ol className="space-y-3">
                          {tweetThread.map((t, i) => (
                            <li
                              key={i}
                              className="rounded-md border p-3 bg-card"
                            >
                              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                <Badge
                                  variant={t.kind === 'hook' ? 'default' : 'secondary'}
                                  className="text-[10px] px-1 py-0"
                                >
                                  {t.kind === 'hook' ? '1/ hook' : `${i + 1}/ follow-up`}
                                </Badge>
                                <span className={t.text.length > 280 ? 'text-destructive' : ''}>
                                  {t.text.length} / 280
                                </span>
                              </div>
                              <p className="text-sm leading-relaxed">{t.text}</p>
                            </li>
                          ))}
                        </ol>
                      )}
                    </SectionCard>
                  </TabsContent>

                  <TabsContent value="seo">
                    <SectionCard
                      title="SEO tags"
                      description="Top 5-10 keywords by frequency (stop words removed, lowercase, de-duplicated)."
                      onRegenerate={() => handleRegenerate('seoTags')}
                      regenerating={regenerating === 'seoTags'}
                    >
                      {seoTags.length === 0 ? (
                        <EmptyHint text="No tags extracted. Add more content to the transcript." />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {seoTags.map((t, i) => (
                            <Badge key={i} variant="outline" className="text-sm py-1 px-2">
                              #{t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </SectionCard>
                  </TabsContent>
                </Tabs>

                <Separator />

                {/* Copy as markdown */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4">
                  <div>
                    <div className="text-sm font-medium">Complete markdown show notes</div>
                    <p className="text-xs text-muted-foreground">
                      Paste-ready doc with chapters, quotes, guest bios, tweet thread, and SEO tags.
                    </p>
                  </div>
                  <Button onClick={handleCopyMarkdown} variant="default" className="shrink-0">
                    <Copy className="size-4" />
                    Copy all as markdown
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </section>
      </main>

      <footer className="mt-auto border-t bg-card">
        <div className="px-4 md:px-6 py-3 text-xs text-muted-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
          <span>
            AI Podcast Show Notes Generator · MVP build · Chapters, quotes, bios, tweets, SEO tags
          </span>
          <span className="text-muted-foreground/70">
            Powered by z-ai-web-dev-sdk (non-streaming completions)
          </span>
        </div>
      </footer>

      {/* New episode dialog */}
      <Dialog open={showNew} onOpenChange={(o) => { setShowNew(o); if (!o) resetForm() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>New episode</DialogTitle>
            <DialogDescription>
              Upload audio (optional — mock transcription will be used as a placeholder) and paste the real transcript.
              Show notes are generated automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="title">Episode title *</Label>
              <Input
                id="title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Ep 42 — The future of AI podcasting"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="podcast">Podcast name</Label>
              <Input
                id="podcast"
                value={formPodcast}
                onChange={(e) => setFormPodcast(e.target.value)}
                placeholder="e.g. The Builders Podcast"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="guests">Guest names</Label>
              <Input
                id="guests"
                value={formGuests}
                onChange={(e) => setFormGuests(e.target.value)}
                placeholder="semicolon-separated, e.g. Alice Lee; Bob Chen"
              />
              <p className="text-xs text-muted-foreground">
                A short LLM-generated bio will be produced for each name. Real bios need web search (stretch goal).
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="audio">Audio file (optional)</Label>
              <Input
                id="audio"
                type="file"
                accept="audio/*"
                onChange={(e) => setFormAudio(e.target.files?.[0] ?? null)}
              />
              {formAudio && (
                <p className="text-xs text-muted-foreground">
                  Selected: {formAudio.name} ({(formAudio.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                MVP saves audio to <code>public/uploads/</code> and uses a mock transcriber. Paste the real transcript below for production use.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="transcript">Transcript</Label>
              <Textarea
                id="transcript"
                value={formTranscript}
                onChange={(e) => setFormTranscript(e.target.value)}
                rows={8}
                placeholder="Paste the full transcript here. Optional timestamps like [00:12] enable chapter detection. Paragraph breaks (blank line) also split chapters."
                className="font-mono text-xs scrollbar-thin"
              />
              <p className="text-xs text-muted-foreground">
                {formTranscript.split(/\s+/).filter(Boolean).length} words · required if no audio file is uploaded.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNew(false); resetForm() }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  Generating show notes...
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  Create episode
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function sectionLabel(s: Section): string {
  switch (s) {
    case 'chapters': return 'Chapters'
    case 'quotes': return 'Quotes'
    case 'bios': return 'Bios'
    case 'tweets': return 'Tweets'
    case 'seoTags': return 'SEO tags'
  }
}

function SectionCard({
  title,
  description,
  onRegenerate,
  regenerating,
  children,
}: {
  title: string
  description: string
  onRegenerate: () => void
  regenerating: boolean
  children: React.ReactNode
}) {
  return (
    <Card className="mt-2">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            disabled={regenerating}
            className="shrink-0"
          >
            {regenerating ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Regenerate
          </Button>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="text-sm text-muted-foreground italic py-2">
      {text}
    </div>
  )
}
