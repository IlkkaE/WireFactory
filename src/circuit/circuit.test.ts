import { describe, expect, it } from 'vitest'
import type { ControlState } from './model'
import { resolve } from './resolver'
import { masterVolumeDocument, starterDocument } from './template'

const full = (selector: ControlState['selector']): ControlState => ({
  selector,
  neckVolume: 'full',
  bridgeVolume: 'full',
  masterVolume: 'full',
  tone: 'full',
})
const codes = (document = starterDocument()) =>
  resolve(document).diagnostics.map((entry) => entry.code)
const rename = <T extends ReturnType<typeof starterDocument>>(document: T) => {
  const ids = new Map(document.instances.map((item, index) => [item.id, `item-${index}`]))
  for (const item of document.instances) item.id = ids.get(item.id)!
  for (const wire of document.wires) {
    const rewrite = (key: string) => {
      const [id, terminal] = key.split(':')
      return `${ids.get(id) ?? id}:${terminal}`
    }
    wire.from = rewrite(wire.from)
    wire.to = rewrite(wire.to)
  }
  return document
}

describe('verified topology resolver', () => {
  it.each([
    ['neck', true, false],
    ['middle', true, true],
    ['bridge', false, true],
  ] as const)('keeps 2V starter selector %s behavior', (selector, neck, bridge) => {
    const result = resolve(starterDocument(), full(selector))
    expect(result.verificationStatus).toBe('verified')
    expect(result.topology?.id).toBe('starter-2hb-2v-1t')
    expect(result.paths.find((path) => path.pickup === 'neck')?.active).toBe(neck)
    expect(result.paths.find((path) => path.pickup === 'bridge')?.active).toBe(bridge)
  })
  it('keeps the shared-output mute when either 2V control is zero in middle', () => {
    const result = resolve(starterDocument(), { ...full('middle'), neckVolume: 'zero' })
    expect(result.outputMuted).toBe(true)
    expect(result.paths.every((path) => !path.active)).toBe(true)
    expect(codes()).not.toContain('HOT_GROUND_SHORT')
  })
  it.each([
    ['neck', true, false],
    ['middle', true, true],
    ['bridge', false, true],
  ] as const)('verifies 1V template at %s and respects master mute', (selector, neck, bridge) => {
    const document = masterVolumeDocument()
    const result = resolve(document, full(selector))
    expect(result.verificationStatus).toBe('verified')
    expect(result.topology?.id).toBe('2hb-1v-1t')
    expect(result.paths.find((path) => path.pickup === 'neck')?.active).toBe(neck)
    expect(result.paths.find((path) => path.pickup === 'bridge')?.active).toBe(bridge)
    const muted = resolve(document, { ...full(selector), masterVolume: 'zero' })
    expect(muted.outputMuted).toBe(true)
  })
  it('identifies both verified templates after instance and endpoint renaming', () => {
    for (const document of [rename(starterDocument()), rename(masterVolumeDocument())])
      expect(resolve(document).verificationStatus).toBe('verified')
  })
  it('uses semantic topology when expectation is null', () => {
    const document = starterDocument()
    document.expectation = null
    expect(resolve(document).verificationStatus).toBe('verified')
  })
  it('reports a modified preset expectation separately from its remaining working pickup', () => {
    const doc = starterDocument()
    doc.wires = doc.wires.filter((w) => w.id !== 'w01')
    const r = resolve(doc)
    expect(r.structuralStatus).toBe('valid')
    expect(r.expectationStatus).toBe('deviated')
    expect(r.paths.filter((p) => p.active).map((p) => p.pickup)).toEqual(['bridge'])
  })
  it('rejects malformed wiring and permanent output shorts independent of wire role', () => {
    const doc = starterDocument()
    doc.wires.push({
      ...doc.wires[0],
      id: 'short',
      from: 'jack:tip',
      to: 'jack:sleeve',
      role: 'tone',
    })
    expect(resolve(doc).buildReady).toBe(false)
    expect(resolve(doc).outputObservations['jack:tip'].state).toBe('muted')
    doc.wires.at(-1)!.to = 'missing:pin'
    expect(codes(doc)).toContain('INVALID_ENDPOINT')
  })
  it('finite capacitors do not become ideal output shorts', () => {
    const doc = starterDocument()
    expect(resolve(doc).outputObservations['jack:tip'].state).toBe('active')
    doc.wires.push({ ...doc.wires[0], id: 'bypass', from: 'cap:a', to: 'cap:b' })
    expect(resolve(doc).structuralStatus).toBe('invalid')
    expect(resolve(doc).expectationStatus).toBe('deviated')
  })
})
