/**
 * Non-streaming chat provider used by the show-notes generators (quote
 * extraction, guest bio lookup, tweet drafting). All three of those tasks
 * produce a small, well-structured JSON payload that fits comfortably in a
 * single completion, so we use `chat.completions.create({ stream: false })`
 * rather than a streaming `ChatProvider`.
 *
 * The provider is pluggable: `ZaiProvider` calls the z-ai-web-dev-sdk chat
 * endpoint; `MockProvider` returns deterministic JSON-shaped payloads so
 * the UI stays demoable offline and unit tests can assert exact outputs.
 *
 * The default provider is decided lazily on first call: if
 * `PODCAST_DISABLE_LLM=1`, MockProvider is used; otherwise ZaiProvider is
 * tried, and any failure (no API key, network error, malformed response)
 * falls back to MockProvider so a request never hard-fails.
 */

export interface ChatProvider {
  /** Returns the full completion as a single string. */
  complete(args: {
    systemPrompt: string
    userPrompt: string
  }): Promise<string>
}

class ZaiProvider implements ChatProvider {
  async complete(args: { systemPrompt: string; userPrompt: string }): Promise<string> {
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      const zai = await ZAI.create()
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: args.systemPrompt },
          { role: 'user', content: args.userPrompt },
        ],
        stream: false,
        thinking: { type: 'disabled' },
      })
      if (typeof completion === 'string') return completion
      const content = (completion as any)?.choices?.[0]?.message?.content
      if (typeof content === 'string') return content
      if (Array.isArray(content)) {
        return content
          .map((c: any) => (typeof c?.text === 'string' ? c.text : ''))
          .join('')
      }
      return ''
    } catch (e) {
      console.warn(
        '[ai] ZAI completion failed, falling back to MockProvider:',
        (e as Error).message,
      )
      return new MockProvider().complete(args)
    }
  }
}

/**
 * Deterministic provider used in tests and when no live LLM is configured.
 * The dispatch is based on keywords in the prompt so a single instance can
 * serve the quote, bio, and tweet pipelines without separate fixtures.
 */
export class MockProvider implements ChatProvider {
  async complete(args: { systemPrompt: string; userPrompt: string }): Promise<string> {
    const blob = (args.userPrompt + '\n' + args.systemPrompt).toLowerCase()
    if (blob.includes('quotable') || (blob.includes('quote') && blob.includes('transcript'))) {
      return JSON.stringify([
        { text: 'The future is already here — it is just not evenly distributed.' },
        { text: 'Simplicity is the ultimate sophistication.' },
        { text: 'Make it work, make it right, make it fast.' },
        { text: 'The best way to predict the future is to invent it.' },
      ])
    }
    if (blob.includes('bio') && (blob.includes('guest') || blob.includes('sentence'))) {
      return 'Guest is a software engineer and podcaster known for their work on AI tooling and developer experience.'
    }
    if (blob.includes('tweet')) {
      return JSON.stringify([
        { kind: 'hook', text: 'New episode dropped: three things I learned about AI podcasting tools.' },
        { kind: 'followup', text: 'First — transcripts unlock searchability and accessibility for every listener.' },
        { kind: 'followup', text: 'Second — chapter markers drive a 30% retention lift in our beta tests.' },
      ])
    }
    return ''
  }
}

let cachedProvider: ChatProvider | null = null

export function getChatProvider(): ChatProvider {
  if (cachedProvider) return cachedProvider
  if (process.env.PODCAST_DISABLE_LLM === '1') {
    cachedProvider = new MockProvider()
    return cachedProvider
  }
  cachedProvider = new ZaiProvider()
  return cachedProvider
}

/** Test-only. Inject a provider (or null to reset). */
export function __setChatProviderForTest(p: ChatProvider | null) {
  cachedProvider = p
}
