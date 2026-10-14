import { describe, expect, it } from 'vitest'
import { definition } from './catalog'
import { DEFAULT_CONTROLS, type WireFactoryDocument } from './model'
import * as analyzer from './resolver'
import {
  splitCoilMonoDocument,
  splitCoilPushPullDocument,
  splitCoilStereoDocument,
} from './template'

/** Builds a net-connectivity predicate from wires plus the contact pairs of a switch state. */
function nets(doc: WireFactoryDocument, states: Record<string, string> = {}) {
  const graph = new Map<string, Set<string>>()
  const edge = (a: string, b: string) => {
    if (!graph.has(a)) graph.set(a, new Set())
    if (!graph.has(b)) graph.set(b, new Set())
    graph.get(a)!.add(b)
    graph.get(b)!.add(a)
  }
  for (const w of doc.wires) edge(w.from, w.to)
  for (const item of doc.instances) {
    // Ideal volume at maximum: the wiper is tied to the input lug.
    if (item.definitionId.startsWith('pot') || item.definitionId.startsWith('push-p'))
      edge(item.id + ':in', item.id + ':out')
    const model = definition(item.definitionId)?.contactModel
    if (!model || item.definitionId.startsWith('pot')) continue
    const state = states[item.id] ?? item.controlState ?? model.defaultState
    for (const [a, b] of model.states.find((s) => s.id === state)!.pairs)
      edge(item.id + ':' + a, item.id + ':' + b)
  }
  return (a: string, b: string) => {
    const seen = new Set([a])
    const queue = [a]
    while (queue.length)
      for (const n of graph.get(queue.pop()!) ?? [])
        if (!seen.has(n)) {
          seen.add(n)
          queue.push(n)
        }
    return seen.has(b)
  }
}

const errors = (doc: WireFactoryDocument) =>
  analyzer
    .resolve(doc, DEFAULT_CONTROLS)
    .diagnostics.filter((d) => d.severity === 'error')
    .map((d) => d.code)

describe('split-coil presets', () => {
  it('stereo: bass half on Tip and treble half on Ring with a common sleeve', () => {
    const doc = splitCoilStereoDocument()
    const same = nets(doc)
    expect(same('bass:hot', 'jack:tip')).toBe(true)
    expect(same('treble:hot', 'jack:ring')).toBe(true)
    expect(same('jack:tip', 'jack:ring')).toBe(false)
    expect(same('bass:hot', 'jack:sleeve')).toBe(false)
    expect(same('treble:hot', 'jack:sleeve')).toBe(false)
    expect(same('bass:ground', 'jack:sleeve')).toBe(true)
    expect(same('treble:ground', 'jack:sleeve')).toBe(true)
    expect(errors(doc)).toEqual([])
  })

  it.each([
    ['on-a', false],
    ['on-b', true],
  ])('mono: series/parallel state %s', (state, series) => {
    const doc = splitCoilMonoDocument()
    const same = nets(doc, { 'series-parallel': state })
    expect(same('bass:hot', 'treble:hot')).toBe(!series)
    expect(same('bass:ground', 'treble:hot')).toBe(series)
    expect(same('bass:ground', 'jack:sleeve')).toBe(!series)
    expect(same('treble:ground', 'jack:sleeve')).toBe(true)
    expect(same('bass:hot', 'jack:tip')).toBe(true)
    expect(same('bass:hot', 'jack:sleeve')).toBe(false)
    doc.instances.find((i) => i.id === 'series-parallel')!.controlState = state
    expect(errors(doc)).toEqual([])
  })

  it('mono: kill switches ground their half only when closed', () => {
    const doc = splitCoilMonoDocument()
    expect(nets(doc)('bass:hot', 'jack:sleeve')).toBe(false)
    expect(nets(doc, { 'bass-kill': 'on' })('bass:hot', 'jack:sleeve')).toBe(true)
    expect(nets(doc, { 'treble-kill': 'on' })('treble:hot', 'jack:sleeve')).toBe(true)
  })

  it.each([
    ['full', 'tip'],
    ['split', 'ring'],
  ])('push-pull: mono/stereo state %s sends the treble half to %s', (state, lug) => {
    const same = nets(splitCoilPushPullDocument(), { 'bass-volume': state })
    expect(same('treble-volume:out', 'jack:' + lug)).toBe(true)
    expect(same('treble-volume:out', 'jack:' + (lug === 'tip' ? 'ring' : 'tip'))).toBe(false)
    expect(same('bass-volume:out', 'jack:tip')).toBe(true)
    expect(same('jack:tip', 'jack:sleeve')).toBe(false)
  })

  it.each([
    ['full', false],
    ['split', true],
  ])('push-pull: series/parallel state %s', (state, series) => {
    const same = nets(splitCoilPushPullDocument(), { 'treble-volume': state })
    expect(same('bass:hot', 'bass-volume:in')).toBe(!series)
    expect(same('treble:ground', 'bass:hot')).toBe(series)
    expect(same('treble:ground', 'jack:sleeve')).toBe(!series)
    expect(same('treble:hot', 'treble-volume:in')).toBe(true)
  })

  it.each(['full', 'split'])('push-pull: analyzer accepts every combination (%s)', (state) => {
    for (const other of ['full', 'split']) {
      const doc = splitCoilPushPullDocument()
      doc.instances.find((i) => i.id === 'bass-volume')!.controlState = state
      doc.instances.find((i) => i.id === 'treble-volume')!.controlState = other
      expect(errors(doc)).toEqual([])
    }
  })
})
