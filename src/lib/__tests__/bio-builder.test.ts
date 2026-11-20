import { test, expect, describe } from 'bun:test'
import {
  buildBioPrompt,
  parseBioResponse,
  fallbackBio,
  buildBios,
} from '../bio-builder'
import { __setChatProviderForTest, type ChatProvider } from '../ai'

describe('buildBioPrompt', () => {
  test('asks for a 1-2 sentence bio', () => {
    const p = buildBioPrompt('Alice Lee')
    expect(p.toLowerCase()).toContain('bio')
    expect(p).toMatch(/1.?2 sentence/i)
  })
  test('includes the guest name', () => {
    const p = buildBioPrompt('Alice Lee')
    expect(p).toContain('Alice Lee')
  })
  test('authorises the fallback when LLM cannot identify the person', () => {
    const p = buildBioPrompt('Unknown Person')
    expect(p.toLowerCase()).toContain('not available')
  })
})

describe('parseBioResponse', () => {
  test('extracts a clean string from plain text', () => {
    expect(parseBioResponse('Alice is a software engineer at Acme.')).toBe(
      'Alice is a software engineer at Acme.',
    )
  })
  test('strips surrounding quotes', () => {
    expect(parseBioResponse('"Alice is an engineer."')).toBe('Alice is an engineer.')
    expect(parseBioResponse('`Alice is an engineer.`')).toBe('Alice is an engineer.')
  })
  test('returns empty string for empty input', () => {
    expect(parseBioResponse('')).toBe('')
    expect(parseBioResponse('   ')).toBe('')
  })
  test('trims whitespace', () => {
    expect(parseBioResponse('  Alice is an engineer.  ')).toBe('Alice is an engineer.')
  })
})

describe('fallbackBio', () => {
  test('returns the canonical "Bio not available" string', () => {
    expect(fallbackBio('Alice')).toBe('Guest: Alice. Bio not available.')
  })
  test('interpolates the name', () => {
    expect(fallbackBio('Bob Chen')).toBe('Guest: Bob Chen. Bio not available.')
    expect(fallbackBio('Bob Chen')).toContain('Bob Chen')
  })
})

describe('buildBios (end-to-end via MockProvider)', () => {
  class MockChat implements ChatProvider {
    async complete(args: { systemPrompt: string; userPrompt: string }): Promise<string> {
      // Echo back a deterministic bio referencing the guest name from the prompt.
      const nameMatch = args.userPrompt.match(/"([^"]+)"/)
      const name = nameMatch ? nameMatch[1] : 'Guest'
      return `${name} is a software engineer and podcaster known for AI tooling.`
    }
  }
  test('returns one GuestBio per input name', async () => {
    __setChatProviderForTest(new MockChat())
    try {
      const bios = await buildBios(['Alice Lee', 'Bob Chen'])
      expect(bios).toHaveLength(2)
      expect(bios[0].name).toBe('Alice Lee')
      expect(bios[0].bio).toContain('Alice Lee')
      expect(bios[1].name).toBe('Bob Chen')
      expect(bios[1].bio).toContain('Bob Chen')
    } finally {
      __setChatProviderForTest(null)
    }
  })
  test('falls back when LLM returns empty', async () => {
    class EmptyMock implements ChatProvider {
      async complete(): Promise<string> {
        return ''
      }
    }
    __setChatProviderForTest(new EmptyMock())
    try {
      const bios = await buildBios(['Mystery Guest'])
      expect(bios).toHaveLength(1)
      expect(bios[0].bio).toBe(fallbackBio('Mystery Guest'))
    } finally {
      __setChatProviderForTest(null)
    }
  })
  test('empty input returns empty array', async () => {
    __setChatProviderForTest(new MockChat())
    try {
      const bios = await buildBios([])
      expect(bios).toEqual([])
    } finally {
      __setChatProviderForTest(null)
    }
  })
})
