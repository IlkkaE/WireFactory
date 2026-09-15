import { beforeEach, expect, it, vi } from 'vitest'
import { definition } from './circuit/catalog'
import { parseProject, stringifyProject } from './circuit/file'
import { DEFAULT_CONTROLS, type WireFactoryDocument } from './circuit/model'
import * as analyzer from './circuit/resolver'
import {
  fiveWaySingleCoilDocument,
  seriesParallelDocument,
  starterDocument,
} from './circuit/template'
import { switchStateLabel } from './circuit/switchLabels'
import { useCircuitStore as store } from './store'

beforeEach(() => {
  vi.restoreAllMocks()
  store.getState().reset()
})
const damaged = () => {
  const doc = starterDocument()
  doc.wires = doc.wires.filter((w) => w.id !== 'w01')
  return doc
}
it('targets inactive coil terminals, keeps shield separate and normalizes invalid endpoints', () => {
  const doc = damaged()
  const inactive = analyzer.resolve(doc).diagnostics.find((d) => d.code === 'INACTIVE_PICKUP')!
  expect(inactive.componentIds).toEqual(['neck'])
  expect(inactive.terminals).toEqual(['neck:hot', 'neck:ground'])
  expect(inactive.suggestion).toContain('hot and cold')
  const wire = { ...doc.wires[0], id: 'broken', from: 'missing:end', to: 'neck:hot' }
  doc.wires.push(wire)
  const invalid = analyzer.resolve(doc).diagnostics.find((d) => d.code === 'INVALID_ENDPOINT')!
  expect(invalid.terminals).toEqual(['neck:hot'])
  expect(invalid.wireIds).toContain('broken')
  expect(new Set(invalid.wireIds).size).toBe(invalid.wireIds?.length)
})
it('targets shield owners with unusual IDs and never invents a global culprit', () => {
  const doc = starterDocument(),
    source = doc.instances[0],
    old = source.id
  source.id = 'odd:"pickup'
  for (const w of doc.wires) {
    if (w.from.startsWith(old + ':')) w.from = source.id + w.from.slice(old.length)
    if (w.to.startsWith(old + ':')) w.to = source.id + w.to.slice(old.length)
    if (w.from === source.id + ':shield') w.to = 'jack:tip'
  }
  const result = analyzer.resolve(parseProject(stringifyProject(doc)))
  const shield = result.diagnostics.find((d) => d.code === 'SHIELD_NOT_GROUNDED')!
  expect(shield.componentIds).toEqual([source.id])
  expect(shield.terminals).toEqual([source.id + ':shield'])
  expect(shield.wireIds?.length).toBe(1)
  const empty = { ...doc, instances: [], wires: [], expectation: null }
  for (const d of analyzer.resolve(empty).diagnostics) {
    expect(d.componentIds).toEqual([])
    expect(d.terminals).toEqual([])
    expect(d.wireIds).toEqual([])
  }
})
it('selection is independent, does not run solver, survives geometry and clears on electrical history', () => {
  const spy = vi.spyOn(analyzer, 'resolve')
  store.getState().open(stringifyProject(damaged()))
  store.getState().check()
  const s = store.getState()
  s.setSelectedWire('w02')
  s.setPendingTerminal('neck:hot')
  s.setSelectedDiagnostic(0)
  expect(store.getState()).toMatchObject({
    selectedWire: 'w02',
    pendingTerminal: 'neck:hot',
    selectedDiagnostic: 0,
  })
  s.move('neck', 120, 90)
  s.undo()
  s.redo()
  expect(store.getState().selectedDiagnostic).toBe(0)
  expect(spy).toHaveBeenCalledTimes(1)
  store.getState().removeWire('w02')
  expect(store.getState().selectedDiagnostic).toBeNull()
  store.getState().check()
  store.getState().setSelectedDiagnostic(0)
  store.getState().undo()
  expect(store.getState().selectedDiagnostic).toBeNull()
  store.getState().redo()
  expect(store.getState().selectedDiagnostic).toBeNull()
})
it('recheck, volume change, successful open and preset loading clear diagnostic selection', () => {
  for (const action of [
    () => store.getState().check(),
    () => store.getState().setControl('neckVolume', 'zero'),
    () => store.getState().open(stringifyProject(starterDocument())),
    () => store.getState().newFiveWay(),
    () => store.getState().newSeriesParallel(),
  ]) {
    store.getState().open(stringifyProject(damaged()))
    store.getState().check()
    store.getState().setSelectedDiagnostic(0)
    expect(store.getState().selectedDiagnostic).toBe(0)
    action()
    expect(store.getState().selectedDiagnostic).toBeNull()
  }
})
function connected(doc: WireFactoryDocument, state: string) {
  const graph = new Map<string, Set<string>>()
  const edge = (a: string, b: string) => {
    if (!graph.has(a)) graph.set(a, new Set())
    if (!graph.has(b)) graph.set(b, new Set())
    graph.get(a)!.add(b)
    graph.get(b)!.add(a)
  }
  for (const w of doc.wires) edge(w.from, w.to)
  const sw = doc.instances.find((i) => i.definitionId === 'dpdt-on-on')!
  for (const [a, b] of definition(sw.definitionId)!.contactModel!.states.find(
    (s) => s.id === state,
  )!.pairs)
    edge(sw.id + ':' + a, sw.id + ':' + b)
  return (a: string, b: string) => {
    const seen = new Set([a]),
      queue = [a]
    while (queue.length)
      for (const n of graph.get(queue.pop()!) ?? [])
        if (!seen.has(n)) {
          seen.add(n)
          queue.push(n)
        }
    return seen.has(b)
  }
}
it.each(['on-a', 'on-b'])(
  'proves the ideal series/parallel nets and separate shields in %s',
  (state) => {
    const doc = seriesParallelDocument(),
      same = connected(doc, state),
      series = state === 'on-b'
    expect(same('neck:hot', 'bridge:hot')).toBe(!series)
    expect(same('neck:ground', 'bridge:hot')).toBe(series)
    expect(same('neck:ground', 'jack:sleeve')).toBe(!series)
    expect(same('neck:hot', 'jack:sleeve')).toBe(false)
    for (const id of ['neck', 'bridge']) expect(same(id + ':shield', 'jack:sleeve')).toBe(true)
    expect(same('bridge:ground', 'jack:sleeve')).toBe(true)
    doc.instances.find((i) => i.definitionId === 'dpdt-on-on')!.controlState = state
    expect(analyzer.resolve(doc).buildReady).toBe(true)
    expect(analyzer.resolve(doc, { ...DEFAULT_CONTROLS, masterVolume: 'zero' }).outputMuted).toBe(
      true,
    )
  },
)
it('keeps named switch labels separate from generic switches and mutes the five-way master', () => {
  const sw = seriesParallelDocument().instances.find((i) => i.definitionId === 'dpdt-on-on')!
  expect(switchStateLabel(sw, { id: 'on-a', label: 'A' })).toBe('Parallel (A)')
  expect(switchStateLabel({ ...sw, values: {} }, { id: 'on-a', label: 'A' })).toBe('A')
  expect(
    analyzer.resolve(fiveWaySingleCoilDocument(), { ...DEFAULT_CONTROLS, masterVolume: 'zero' })
      .outputMuted,
  ).toBe(true)
})

it('uses the five-way stored state for the live output as well as the state table', () => {
  const expected = [['neck'], ['middle', 'neck'], ['middle'], ['bridge', 'middle'], ['bridge']]
  for (const [index, state] of ['one', 'two', 'three', 'four', 'five'].entries()) {
    const doc = fiveWaySingleCoilDocument()
    doc.instances.find((i) => i.id === 'selector')!.controlState = state
    const result = analyzer.resolve(doc, DEFAULT_CONTROLS)
    expect(
      result.paths
        .filter((p) => p.active)
        .map((p) => p.pickup)
        .sort(),
    ).toEqual(expected[index])
    expect(Object.values(result.outputObservations).some((o) => o.state === 'active')).toBe(true)
  }
})
