import { readFileSync } from 'node:fs'
import { resolve } from './resolver'
import { describe, expect, it } from 'vitest'
import { parseProject, stringifyProject } from './file'
import {
  fiveWaySingleCoilDocument,
  masterVolumeDocument,
  seriesParallelDocument,
  starterDocument,
} from './template'

describe('.wirefactory parser', () => {
  it('opens the original v1 starter fixture without changing it', () => {
    // Frozen from baseline commit b8d8e2d, independently of today's template builder.
    const text = readFileSync(
      new URL('../../tests/fixtures/baseline-v1.json', import.meta.url),
      'utf8',
    )
    const document = parseProject(text)
    expect(document).toEqual(JSON.parse(text))
    expect(resolve(document).verificationStatus).toBe('verified')
  })
  it('round-trips both verified topology documents', () => {
    for (const document of [
      starterDocument(),
      masterVolumeDocument(),
      fiveWaySingleCoilDocument(),
      seriesParallelDocument(),
    ])
      expect(parseProject(stringifyProject(document))).toEqual(document)
  })
  it('rejects unsupported document and pinout versions', () => {
    const version = JSON.parse(stringifyProject(starterDocument())) as Record<string, unknown>
    version.version = 2
    expect(() => parseProject(JSON.stringify(version))).toThrow('Unsupported .wirefactory')
    const pinout = starterDocument()
    pinout.instances[0].pinoutVersion = 2 as 1
    expect(() => parseProject(stringifyProject(pinout))).toThrow('Unknown component')
  })
  it('rejects unknown endpoint and duplicate component ids before replace', () => {
    const invalid = starterDocument()
    invalid.wires[0].from = 'neck:missing'
    expect(() => parseProject(stringifyProject(invalid))).toThrow('Invalid wire endpoint')
    const duplicate = starterDocument()
    duplicate.instances[1].id = duplicate.instances[0].id
    expect(() => parseProject(stringifyProject(duplicate))).toThrow('Duplicate component id')
  })
  it('rejects an unknown pinout id before replacing state', () => {
    const document = starterDocument()
    document.instances[0].pinoutId = 'not-a-known-pinout'
    expect(() => parseProject(stringifyProject(document))).toThrow('Unknown component')
  })
  it('retains v1 safety limits', () => {
    const oversized = starterDocument()
    oversized.instances = Array.from({ length: 81 }, (_, index) => ({
      ...oversized.instances[0],
      id: `pickup-${index}`,
    }))
    expect(() => parseProject(stringifyProject(oversized))).toThrow('safety limits')
  })
})
