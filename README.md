# AI Podcast Show Notes Generator

Upload a podcast audio file (or just paste the transcript) and the app auto-generates a complete show-notes package: **chapters**, **key quotes** with timestamps, **guest bios**, a **tweet thread** (hook + 2 follow-ups), and **SEO tags** — all editable and exportable as a single markdown doc.

Built as Project #50 of the 110-project portfolio plan.

```
┌──────────────────────────────────────────────────────────────────────┐
│  AI Podcast Show Notes Generator               [New episode]         │
├────────────────┬─────────────────────────────────────────────────────┤
│  Episodes (3)  │  The Builders — Ep 42                                │
│  ────────────  │  [podcast] [1h 0m 0s] [ready]                         │
│  ▸ Ep 42       │  ─────────────────────────────                       │
│    Ep 41       │  ▶ audio player (if uploaded)                        │
│    Ep 40       │  Transcript: [editable textarea]      [Save]         │
│                │  ─────────────────────────────                       │
│                │  [Chapters][Quotes][Bios][Tweets][SEO]  [Regenerate]│
│                │   00:00 — Welcome to the show                        │
│                │   00:30 — The future of AI podcasting                │
│                │  ─────────────────────────────                       │
│                │                              [Copy all as markdown]  │
└────────────────┴─────────────────────────────────────────────────────┘
```

---

## MVP scope vs. stretch goals

This repo is the **MVP** — every feature below marked MVP works end-to-end with no external dependencies beyond the optional z-ai-web-dev-sdk chat completion.

| Feature | MVP | Stretch |
|---|---|---|
| Audio upload | Saved to `public/uploads/<uuid>.<ext>` on disk | Upload to Cloudflare R2 (presigned URLs) |
| Transcription | Paste the transcript, OR upload audio + use a mock transcriber that returns a placeholder transcript | Real Whisper transcription via `zai.audio.asr.create` (requires base64 audio) |
| Chapter detection | Pure-function heuristic — splits on gap > 5s between captions OR paragraph breaks; title is first sentence truncated to 8 words | LLM-based topic modelling; UI for manual chapter title edits |
| Key quote extraction | LLM call asks for 3-5 quotable sentences; timestamp estimated by string match against the transcript | LLM picks quotes + assigns timestamps directly |
| Guest bio lookup | LLM call asks for a 1-2 sentence bio from the guest name; explicitly authorises the "Bio not available" fallback | `zai.functions.invoke('web_search', ...)` to ground bios in fresh sources |
| Tweet thread drafting | LLM call asks for 3 tweets (hook + 2 follow-ups), each ≤ 280 chars; parser truncates any > 280 | Variations per platform (LinkedIn, Threads, Mastodon) |
| SEO tags | Pure-function keyword frequency (top 5-10 tokens, stop words removed, lowercase, deduped) | LLM-generated tags + auto-podcast-category mapping |
| Transcript editor | Inline `<textarea>` — user can fix transcription errors before generating show notes | Diff view, find/replace, speaker diarisation labels |
| Multi-podcast RSS | Single-tenant — one podcast per episode | Ingest by RSS feed URL; auto-detect new episodes |

The README documents every stretch goal inline with the code so the gap is obvious to anyone reading the source.

---

## Features

- **Two transcription modes** — paste the full transcript (with optional timestamps like `[00:12]` or `[01:02:33]`), or upload audio and let the mock transcriber produce a placeholder so the rest of the pipeline still runs end-to-end.
- **Pure-function chapter detection** — `detectChapters(transcript)` splits the transcript at topic-shift boundaries (gap > 5s between captions, OR paragraph breaks in the raw text). Each chapter's title is the first sentence of the chapter, truncated to 8 words. Plain (untimestamped) transcripts split by paragraph with virtual 60-second timestamps.
- **Key quote extraction with timestamp estimation** — the LLM returns 3-5 quotable sentences; the parser string-matches each quote against the transcript and walks backwards to the nearest `[MM:SS]` marker to estimate its start timestamp.
- **Guest bio lookup with graceful fallback** — for each guest name, the LLM is asked for a 1-2 sentence bio. The prompt explicitly authorises the fallback "Guest: [name]. Bio not available." when the model cannot confidently identify the person — so fabricated credentials never leak into the show notes.
- **Tweet thread drafting** — the LLM writes a 3-tweet thread (hook + 2 follow-ups). The parser enforces the count (caps at 3) and truncates any tweet longer than 280 chars rather than dropping it.
- **SEO tags by keyword frequency** — `extractSeoTags(transcript)` tokenizes the transcript, drops English + CJK + podcast-filler stop words, and returns the top 5-10 lowercase deduped tokens ranked by frequency (ties broken alphabetically).
- **Per-section regenerate** — each generated section (chapters, quotes, bios, tweets, SEO tags) has a Regenerate button that re-runs ONLY that section. Re-running chapters is a pure-function call (no LLM); re-running quotes/bios/tweets is a single LLM call.
- **Auto transcript editor** — the transcript is editable inline. Saving re-runs chapter detection (pure-function) on the new transcript but not the LLM calls unless `regenerateLLM=true` is passed.
- **Markdown show notes export** — `formatShowNotes(episode)` assembles a complete markdown doc with chapters list, key quotes (blockquoted with timestamps), guest bios, tweet thread (numbered 1/2/3), and SEO tags (as `#hashtag` list). One click copies it to the clipboard.
- **85 unit tests** — chapter detection, quote extraction + timestamp estimation, bio builder + fallback, tweet parser + truncation, SEO tags (frequency, stop words, dedupe, lowercase, ties), show-notes formatter, MockProvider deterministic outputs. Pure-function modules so the suite runs in ~24ms.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | Route Handlers for the API, React Server Components for the page shell |
| Language | TypeScript 5 (strict) | End-to-end type safety for the Episode + section types |
| Styling | Tailwind CSS 4 + shadcn/ui | Copy-paste component primitives, theme tokens, `oklch` color palette |
| Database | SQLite + Prisma 6 | Local-first, zero-infra. All generated artifacts JSON-serialized into `TEXT` columns. |
| LLM | `z-ai-web-dev-sdk` chat completions (`stream: false`) | Non-streaming `complete()` returns the full JSON payload in one round-trip — perfect for quote/bio/tweet extraction |
| Audio | Disk under `public/uploads/` | MVP — no R2 credentials required |
| Tests | `bun test` | Built-in, ~24ms for the full suite |
| Lint | ESLint (eslint-config-next) | Next.js + TypeScript rules |

---

## Architecture

```
                  ┌────────────────────────────────────────────────┐
                  │           Next.js 16 (App Router)               │
                  │                                                │
  multipart ──POST /api/episodes──►  save audio to public/uploads/  │
                  │                       │                        │
                  │                       ▼                        │
                  │              detectChapters(transcript)         │  pure-function
                  │              estimateDurationSec(transcript)    │
                  │                       │                        │
                  │                       ▼                        │
                  │              ┌────────┴────────┐                 │
                  │              │ ChatProvider    │  (pluggable)    │
                  │              │  .complete()    │                 │
                  │              └────────┬────────┘                 │
                  │                       │                        │
                  │        ┌──────────────┼──────────────┐           │
                  │        ▼              ▼              ▼           │
                  │  extractQuotes  buildBios  buildTweetThread     │  LLM calls
                  │  (JSON 3-5)    (1-2 sent)  (3 tweets ≤280)      │
                  │        │              │              │           │
                  │        └──────────────┼──────────────┘           │
                  │                       ▼                        │
                  │              extractSeoTags(transcript)         │  pure-function
                  │                       │                        │
                  │                       ▼                        │
                  │              SQLite (Prisma) — Episode          │
                  │                       ▲                        │
                  │   GET /api/episodes/[id]  ──────────────────────┤
                  │   PATCH  ─►  re-run chapter detection (pure)    │
                  │              optionally re-run LLM if flag set  │
                  │   POST /regenerate  ─►  re-run one section only │
                  │   GET /api/stats  ─►  { episodes, totalDurSec } │
                  │                                                │
                  │              formatShowNotes(episode)            │  pure-function
                  │                       │                        │
                  │                       ▼                        │
                  │              ──► clipboard / .md download       │
                  └────────────────────────────────────────────────┘
```

### MVP pipeline (POST /api/episodes)

1. **Ingest** — `Request.formData()` parses the multipart payload (`file=audio` optional, plus `title`, `podcastName`, `transcript`, `guestNames` semicolon-separated).
2. **Save audio** — if present, write to `public/uploads/<uuid>.<ext>`; record its public path. If no transcript was pasted, the mock transcriber fills in a placeholder so the rest of the pipeline still runs.
3. **Chapters (pure)** — `detectChapters(transcript)` runs synchronously, no LLM. Two modes: timestamped (`[MM:SS]` markers, splits on gap > 5s or paragraph break) or plain (paragraph splits with virtual 60-second timestamps).
4. **LLM calls** — `extractQuotes`, `buildBios`, `buildTweetThread` run in parallel via `Promise.all`. Each builds a prompt, calls `ChatProvider.complete()`, and parses the JSON response with a tolerant parser that handles prose wrappers and partial JSON. Each parser has a strict contract (count, max length, fallback string).
5. **SEO tags (pure)** — `extractSeoTags(transcript)` runs synchronously via the tokenizer.
6. **Persist** — all artifacts JSON-serialized into the Episode row; status set to `ready`.

### Regeneration pipeline (POST /api/episodes/[id]/regenerate)

The `section` body field (`chapters` | `quotes` | `bios` | `tweets` | `seoTags`) selects exactly one section to re-run. The route re-reads the (possibly edited) transcript from the DB, runs only the requested section's generator, and overwrites only that JSON column. The other sections stay untouched.

### PATCH pipeline (PATCH /api/episodes/[id])

Editing the transcript re-runs **chapter detection only** (pure-function, ~ms) so the chapters always reflect the current transcript. The LLM-driven sections (quotes, bios, tweets) are NOT re-run unless `regenerateLLM: true` is passed — this keeps the save cheap and prevents burning tokens on every keystroke. With `regenerateLLM: true`, all four LLM/pure sections are recomputed against the new transcript.

---

## Case study — the interesting parts

### Chapter detection (`src/lib/chapter-detector.ts`)

The trick is handling **both** timestamped and plain transcripts with one function. Timestamped mode parses every `[MM:SS]` or `[HH:MM:SS]` marker into a `Caption { startSec, text, rawPos }` and walks adjacent pairs looking for two split signals: a > 5-second gap, OR a blank line (`\n\s*\n`) in the raw transcript between the two markers. We track `rawPos` (the byte offset of each marker in the raw string) so the paragraph-break check is a single regex on the slice between two markers — no separate tokenisation pass needed.

Plain mode (no markers) splits on `\n\s*\n` and gives each paragraph a virtual 60-second timestamp so the UI has something to render. The chapter `title` is the first sentence truncated to 8 words via `firstSentenceTruncated()` — a regex match for `^[^.!?\n]+[.!?]?` followed by `split(/\s+/).slice(0, 8)`. This is intentionally a heuristic, not LLM-driven: chapter titles need to be deterministic and instant, and the LLM is bad at the "first 8 words of this sentence" instruction.

### Quote extraction + timestamp estimation (`src/lib/quote-extractor.ts`)

The LLM is asked for the **text only** (no timestamps) — it's much better at picking quotable sentences than at computing offsets. The parser then estimates each quote's `timestampSec` by string-matching the first 40 chars of the quote against the transcript (lowercased), slicing everything before the match, and walking backwards with a global regex for `[MM:SS]`/`[HH:MM:SS]` markers — the last match wins. If the quote isn't found or no marker precedes it, the timestamp falls back to 0. This is robust to the LLM picking a slightly paraphrased quote (the 40-char prefix is usually preserved verbatim) and to the LLM inventing a quote that isn't in the transcript (returns 0, no crash).

### Guest bio lookup (`src/lib/bio-builder.ts`)

The prompt explicitly authorises the fallback `"Guest: [name]. Bio not available."` when the LLM cannot confidently identify the person. This is the single most important prompt-engineering choice in the project: without it, the LLM will happily invent credentials ("Alice Lee is a Nobel-winning marine biologist at Stanford") for any name you feed it, and those fabricated bios will get pasted straight into a public show-notes page. The parser also strips wrapping quotes (the LLM sometimes returns `"Alice is..."` instead of `Alice is...`) and falls back to `fallbackBio(name)` when the parsed bio is empty.

### Tweet drafting (`src/lib/tweet-builder.ts`)

Three rules in the parser:
1. **Count** — slice to 3. The LLM sometimes returns 4-5 tweets if the episode is interesting; we keep the first 3 to honour the "hook + 2 follow-ups" structure.
2. **Length** — truncate to 280 chars. The prompt says ≤ 280, but the LLM occasionally slips; we'd rather ship a slightly truncated tweet than drop it.
3. **Kind** — the first tweet is always tagged `hook`, the rest `followup`, regardless of what the LLM returned. This keeps the UI's "1/ hook" vs "2/ follow-up" labels correct even when the LLM mislabels.

### SEO tags (`src/lib/seo-tags.ts`)

Reuses the tokenizer from the parent project's retrieval stack (lowercase → strip markdown + URLs + timestamp markers → Unicode-aware tokenisation → drop 1-char tokens + stop words). The stop word list is extended with podcast-filler words (`like`, `really`, `okay`, `yeah`, `gonna`, `know`, `think`, ...) which appear hundreds of times in spoken-word transcripts and would otherwise dominate the top tags. Frequency count via `Map`, sort by descending count with alphabetical tiebreak, slice to 5-10.

---

## Setup

```bash
# 1. Install deps
bun install

# 2. Apply the Prisma schema to SQLite
bun run db:push
# (the script inlines DATABASE_URL="$(pwd)/db/custom.db" so you don't need an .env)

# 3. Run the dev server
bun run dev
# → http://localhost:3000

# 4. (optional) Run the test suite
bun test

# 5. (optional) Lint
bun run lint
```

### Environment variables

Copy `.env.example` to `.env` if you want to override the defaults. The package.json `db:*` scripts inline `DATABASE_URL="$(pwd)/db/custom.db"` for you, so you only need an `.env` if you're invoking `prisma` directly.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes (for Prisma CLI) | `file:$(pwd)/db/custom.db` (inlined in scripts) | Absolute path to the SQLite file. |
| `PODCAST_DISABLE_LLM` | no | unset | Set to `1` to force the MockProvider (deterministic quotes/bios/tweets, no network calls). Useful for offline dev + CI. |
| `ZAI_*` | no | unset | The z-ai-web-dev-sdk reads its own credentials from the environment when `ZAI.create()` is called. If absent, `ZaiProvider.complete()` falls back to `MockProvider` automatically. |

---

## Project structure

```
50-ai-podcast-show-notes/
├── prisma/
│   └── schema.prisma              # Episode model (chapters/quotes/etc. as JSON TEXT)
├── public/
│   └── uploads/                  # audio files saved here as <uuid>.<ext> (gitignored)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── episodes/
│   │   │   │   ├── route.ts                       # POST + GET (list)
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts                   # GET + PATCH + DELETE
│   │   │   │       └── regenerate/route.ts        # POST single-section regen
│   │   │   └── stats/route.ts                     # GET { episodes, totalDurationSec }
│   │   ├── globals.css                            # Tailwind 4 + shadcn tokens
│   │   ├── layout.tsx                             # Geist font + Sonner toaster
│   │   └── page.tsx                               # 2-column + tabbed show notes UI
│   ├── components/
│   │   └── ui/                                    # shadcn/ui (New York) — only what we use
│   │       ├── button.tsx  card.tsx  dialog.tsx
│   │       ├── input.tsx  textarea.tsx  label.tsx
│   │       ├── badge.tsx  tabs.tsx  scroll-area.tsx
│   │       ├── separator.tsx  skeleton.tsx  sonner.tsx
│   └── lib/
│       ├── ai.ts                                  # ChatProvider + ZaiProvider + MockProvider
│       ├── chapter-detector.ts                    # detectChapters + estimateDurationSec
│       ├── quote-extractor.ts                     # buildQuotePrompt + parseQuotesResponse
│       ├── bio-builder.ts                         # buildBioPrompt + parseBioResponse + fallbackBio
│       ├── tweet-builder.ts                       # buildTweetPrompt + parseTweetsResponse
│       ├── seo-tags.ts                            # extractSeoTags (pure-function)
│       ├── show-notes-formatter.ts                # formatShowNotes (pure-function)
│       ├── tokenizer.ts                           # tokenize + termFrequencies
│       ├── types.ts                                # Episode + Chapter/Quote/GuestBio/Tweet + parsers
│       ├── db.ts                                   # PrismaClient singleton
│       ├── utils.ts                                # cn() tailwind helper
│       └── __tests__/
│           ├── chapter-detector.test.ts           # 17 tests
│           ├── quote-extractor.test.ts            # 13 tests
│           ├── bio-builder.test.ts                 # 12 tests
│           ├── tweet-builder.test.ts               # 12 tests
│           ├── seo-tags.test.ts                    # 9 tests
│           ├── show-notes-formatter.test.ts        # 12 tests
│           └── ai.test.ts                          # 10 tests  (MockProvider end-to-end)
├── package.json                  # db:* scripts inline DATABASE_URL
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── tailwind.config.ts
├── components.json               # shadcn config (New York, lucide icons)
├── eslint.config.mjs
├── .env.example
├── .gitignore
├── LICENSE                       # MIT
└── README.md                      # you are here
```

---

## Tests

```bash
bun test
```

85 tests, ~24ms. Every LLM-driven section has both **prompt-builder** tests (assert the prompt contains the right keywords + shape) and **parser** tests (assert the parser tolerates malformed JSON, enforces counts, truncates over-length content, falls back gracefully). The `ai.test.ts` suite injects a `MockProvider` via `__setChatProviderForTest` and asserts the end-to-end `extractQuotes` / `buildBios` / `buildTweetThread` pipeline returns the deterministic mock outputs.

The pure-function sections (`chapter-detector`, `seo-tags`, `show-notes-formatter`) have no LLM dependency and run with no provider set.

---

## What I'd do differently

- **Real Whisper transcription via the z-ai SDK** — `zai.audio.asr.create({ audio: base64EncodedAudio })` would replace the mock transcriber. The MVP avoids this because the SDK requires the audio as base64, which means the entire file has to fit in memory and round-trip through the API in one request — not great for 60-minute episodes. The right architecture is a background worker that uploads to R2, then a separate ASR job that streams the audio in chunks; both are stretch goals.
- **Real web search for guest bios** — `zai.functions.invoke('web_search', { query: guestName })` would ground each bio in fresh sources instead of relying on the LLM's training data. The MVP's prompt explicitly authorises the "Bio not available" fallback rather than letting the model invent credentials — that's the right safety choice for a public-facing show notes page, but it means most guests get the fallback. Real web search would close that gap.
- **Real audio upload to Cloudflare R2** — the MVP saves audio to `public/uploads/` which works locally but is wrong in production (no auth, no rate limit, Next.js `/public` isn't a file backend). Presigned R2 URLs would let the browser upload directly without routing audio bytes through the Next.js server.
- **Multi-podcast RSS ingest** — subscribe to a podcast's RSS feed, auto-create an Episode for each new item, run the pipeline in the background. The schema already has `podcastName` so adding a `Podcast` model + RSS poller is a small change.
- **Chapter editor UI** — let the user click into a chapter title and rename it. The current model treats chapters as pure-function output; an editable chapter model would need a separate `Chapter` table (or an override field on `Episode`) so user edits survive a Regenerate.
- **Streaming LLM responses** — the current `complete()` is non-streaming because quote/bio/tweet responses are small JSON payloads. If we add a longer-form section (episode summary, blog-post variation), a streaming `stream()` method on the same `ChatProvider` interface would let us render tokens as they arrive.

---

## Resume bullet

> Built an AI Podcast Show Notes Generator with Next.js 16, Prisma 6 + SQLite, and the z-ai-web-dev-sdk. Designed a pure-function chapter detector that splits transcripts on > 5s gaps or paragraph breaks, an LLM-driven quote extractor that estimates timestamps by string-matching against the transcript, and a pluggable `ChatProvider` interface with a deterministic `MockProvider` for offline tests. Shipped 85 unit tests (~24ms) covering prompt builders, JSON parsers with malformed-input tolerance, and end-to-end pipeline runs.

---

## License

MIT — see [LICENSE](./LICENSE).

---

## Push to GitHub

```bash
gh repo create ai-podcast-show-notes --public --source=. --remote=origin --push
```
