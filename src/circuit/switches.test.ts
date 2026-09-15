import { wirePoints } from './layout'
import { describe, expect, it } from 'vitest'
import { catalog, definition } from './catalog'
import { componentGeometry, primitiveSvg } from './componentGeometry'
import { buildSvg } from './export'
import { parseProject, stringifyProject } from './file'
import { DEFAULT_CONTROLS, type Instance } from './model'
import { resolve } from './resolver'
import { splitDocument, starterDocument } from './template'
import { useCircuitStore } from '../store'

const added = (definitionId: string): Instance => ({
  id: 'extra',
  definitionId,
  definitionVersion: 1,
  pinoutId: definitionId + '-generic',
  pinoutVersion: 1,
  values: {},
  x: 10,
  y: 20,
  rotation: 0,
  label: 'Extra',
})
describe('switch contracts and split signal paths', () => {
  it('covers all switch definitions with valid explicit contacts', () => {
    for (const part of catalog.filter((part) => part.category === 'Switches')) {
      expect(part.contactModel, part.id).toBeDefined()
      const model = part.contactModel!
      expect(model.states.some((state) => state.id === model.defaultState)).toBe(true)
      for (const state of model.states)
        for (const [a, b] of state.pairs) {
          expect(part.terminals.some((pin) => pin.id === a)).toBe(true)
          expect(part.terminals.some((pin) => pin.id === b)).toBe(true)
          expect(a).not.toBe(b)
        }
    }
    expect(definition('spst-on-off')!.contactModel!.states.map((s) => s.pairs)).toEqual([
      [],
      [['a', 'b']],
    ])
    expect(definition('spdt-on-on')!.contactModel!.states.map((s) => s.pairs)).toEqual([
      [['common', 'a']],
      [['common', 'b']],
    ])
    expect(definition('spdt-on-off-on')!.contactModel!.states.map((s) => s.pairs)).toEqual([
      [['common', 'a']],
      [],
      [['common', 'b']],
    ])
    expect(definition('dpdt-on-off-on')!.contactModel!.states.map((s) => s.pairs)).toEqual([
      [
        ['a2', 'a1'],
        ['b2', 'b1'],
      ],
      [],
      [
        ['a2', 'a3'],
        ['b2', 'b3'],
      ],
    ])
    expect(definition('dpdt-on-on-on')!.contactModel!.states[1].pairs).toEqual([
      ['a2', 'a1'],
      ['b2', 'b3'],
    ])
    expect(definition('dpdt-on-on-on')!.limitation).toContain('variants differ')
  })
  it('distinguishes three-way single throws, five-way overlaps and four independent superswitch poles', () => {
    const contacts = (id: string) => definition(id)!.contactModel!.states.map((s) => s.pairs)
    expect(contacts('three-way-blade')).toEqual([
      [
        ['a0', 'a1'],
        ['b0', 'b1'],
      ],
      [
        ['a0', 'a2'],
        ['b0', 'b2'],
      ],
      [
        ['a0', 'a3'],
        ['b0', 'b3'],
      ],
    ])
    expect(contacts('five-way-blade')).toEqual([
      [
        ['a0', 'a1'],
        ['b0', 'b1'],
      ],
      [
        ['a0', 'a1'],
        ['a0', 'a2'],
        ['b0', 'b1'],
        ['b0', 'b2'],
      ],
      [
        ['a0', 'a2'],
        ['b0', 'b2'],
      ],
      [
        ['a0', 'a2'],
        ['a0', 'a3'],
        ['b0', 'b2'],
        ['b0', 'b3'],
      ],
      [
        ['a0', 'a3'],
        ['b0', 'b3'],
      ],
    ])
    expect(contacts('four-pole-five-throw')).toEqual(
      [1, 2, 3, 4, 5].map((n) => ['a', 'b', 'c', 'd'].map((p) => [p + 'c', p + n])),
    )
  })
  for (const kind of ['push-pull-dpdt', 'push-push-dpdt'] as const) {
    it(
      kind + ' resolves both coil configurations, every selector position and zero-volume muting',
      () => {
        for (const switchState of ['full', 'split'])
          for (const selector of ['neck', 'middle', 'bridge'] as const)
            for (const masterVolume of ['full', 'zero'] as const) {
              const doc = splitDocument(kind)
              doc.instances.find((p) => p.id === 'tone')!.controlState = switchState
              const r = resolve(doc, { ...DEFAULT_CONTROLS, selector, masterVolume })
              expect(r.verificationStatus).toBe('verified')
              expect(r.diagnostics.some((d) => d.code === 'HOT_GROUND_SHORT')).toBe(false)
              expect(r.outputMuted).toBe(masterVolume === 'zero')
              expect(r.paths.filter((p) => p.active).map((p) => p.coilMode)).toEqual(
                r.paths
                  .filter((p) => p.active)
                  .map(() => (switchState === 'full' ? 'series' : 'split')),
              )
              expect(
                r.paths
                  .filter((p) => p.active)
                  .every((p) => p.coilCount === (switchState === 'split' ? 1 : 2)),
              ).toBe(true)
              expect(r.paths.filter((p) => p.active).map((p) => p.pickup)).toEqual(
                masterVolume === 'zero'
                  ? []
                  : selector === 'middle'
                    ? ['neck', 'bridge']
                    : [selector],
              )
            }
      },
    )
    it(kind + ' isolates a removed pickup while retaining the remaining source', () => {
      const doc = splitDocument(kind)
      doc.expectation = null
      doc.wires = doc.wires.filter(
        (w) => w.from !== 'neck:north-start' && w.to !== 'neck:north-start',
      )
      const r = resolve(doc)
      expect(r.structuralStatus).toBe('valid')
      expect(r.paths.filter((p) => p.active).map((p) => p.pickup)).toEqual(['bridge'])
    })
  }
  it('keeps selector geometry, persisted state, direct API overrides and function tables consistent', () => {
    const doc = splitDocument()
    doc.instances.find((p) => p.id === 'selector')!.controlState = 'neck'
    const opened = parseProject(stringifyProject(doc))
    expect(
      resolve(opened)
        .paths.filter((p) => p.active)
        .map((p) => p.pickup),
    ).toEqual(['neck'])
    const other = resolve(opened, { ...DEFAULT_CONTROLS, selector: 'bridge' })
    expect(other.buildReady).toBe(true)
    expect(other.paths.filter((p) => p.active).map((p) => p.pickup)).toEqual(['bridge'])
    expect(other.functionTable).toHaveLength(6)
    expect(other.functionTable.filter((row) => row.neck && row.bridge)).toHaveLength(2)
  })
  it('persists switch edits through undo, redo and open; invalid states cannot replace the document', () => {
    const store = useCircuitStore
    store.getState().newSplit('push-push-dpdt')
    store.getState().setControl('selector', 'neck')
    store.getState().setComponentState('tone', 'split')
    const saved = stringifyProject(store.getState().doc)
    store.getState().undo()
    expect(store.getState().doc.instances.find((p) => p.id === 'tone')!.controlState).toBe('full')
    store.getState().redo()
    expect(store.getState().doc.instances.find((p) => p.id === 'tone')!.controlState).toBe('split')
    store.getState().reset()
    store.getState().open(saved)
    expect(store.getState().controls.selector).toBe('neck')
    const invalid = JSON.parse(saved)
    invalid.instances.find((p: Instance) => p.id === 'tone').controlState = 'invented'
    expect(() => store.getState().open(JSON.stringify(invalid))).toThrow('Invalid switch state')
    expect(store.getState().doc).toEqual(JSON.parse(saved))
    expect(resolve(invalid).verificationStatus).toBe('invalid')
  })
  it('detects actual closed-switch shorts independent of wire role and does not verify an arbitrary catalogue circuit', () => {
    const doc = starterDocument()
    doc.expectation = null
    const part = added('spst-on-off')
    doc.instances.push(part)
    doc.wires.push(
      {
        id: 'x1',
        from: 'extra:a',
        to: 'jack:tip',
        role: 'tone',
        color: '#ffffff',
        label: '',
        waypoints: [],
      },
      {
        id: 'x2',
        from: 'extra:b',
        to: 'jack:sleeve',
        role: 'tone',
        color: '#ffffff',
        label: '',
        waypoints: [],
      },
    )
    expect(resolve(doc).verificationStatus).toBe('verified')
    expect(resolve(doc).diagnostics.some((d) => d.code === 'HOT_GROUND_SHORT')).toBe(false)
    part.controlState = 'on'
    expect(resolve(doc).outputObservations['jack:tip'].state).toBe('muted')
  })
  it('roundtrips the deprecated SPST id without offering it as a new definition migration', () => {
    const doc = starterDocument()
    doc.expectation = null
    doc.instances.push(added('spst-on-on'))
    const opened = parseProject(stringifyProject(doc))
    expect(opened.instances.at(-1)!.definitionId).toBe('spst-on-on')
    expect(resolve(opened).verificationStatus).toBe('verified')
  })
  it('uses the same original primitives and anchors in SVG and distinct artwork for requested families', () => {
    const doc = splitDocument(),
      svg = buildSvg(doc, resolve(doc))
    for (const item of doc.instances) {
      const geometry = componentGeometry(item)
      expect(geometry).toEqual(componentGeometry(item))
      for (const p of geometry.primitives) expect(svg).toContain(primitiveSvg(p))
      for (const [pin, point] of Object.entries(geometry.terminals))
        expect(svg).toContain(
          'data-terminal="' + item.id + ':' + pin + '" cx="' + point.x + '" cy="' + point.y + '"',
        )
    }
    for (const [a, b] of [
      ['single-coil', 'p90'],
      ['pot-500k-audio', 'stacked-pot'],
      ['capacitor', 'resistor'],
      ['resistor', 'treble-bleed'],
      ['shield', 'bridge-ground'],
    ])
      expect(componentGeometry(added(a)).primitives).not.toEqual(
        componentGeometry(added(b)).primitives,
      )
    const switched = added('push-pull-dpdt')
    const before = componentGeometry(switched)
    switched.controlState = 'split'
    const after = componentGeometry(switched)
    expect(before.terminals).toEqual(after.terminals)
    expect(before.primitives).not.toEqual(after.primitives)
    expect(Object.keys(before.terminals)).toHaveLength(9)
  })
})

it('keeps the split B-pole side exit visibly separated from a nearby parallel lead', () => {
  const doc = splitDocument(),
    wire = doc.wires.find((w) => w.id === 'w18')!,
    points = wirePoints(doc, wire)
  const finish = points.at(-1)!,
    escape = points.at(-2)!
  expect(escape.x).toBeGreaterThan(finish.x)
  const outsideVertical = points
    .slice(1)
    .some(
      (point, index) =>
        point.x === points[index].x &&
        point.x >= escape.x &&
        Math.abs(point.y - points[index].y) >= 24,
    )
  expect(outsideVertical).toBe(true)
})

it('uses an unassigned three-way switch own contacts instead of the global pickup selector', () => {
  const doc = starterDocument()
  doc.expectation = null
  const extra = added('three-way-toggle')
  extra.controlState = 'neck'
  doc.instances.push(extra)
  doc.wires.push(
    {
      id: 'extra-hot',
      from: 'extra:bridge',
      to: 'jack:tip',
      role: 'signal',
      color: '#ffffff',
      label: '',
      waypoints: [],
    },
    {
      id: 'extra-ground',
      from: 'extra:common',
      to: 'jack:sleeve',
      role: 'ground',
      color: '#ffffff',
      label: '',
      waypoints: [],
    },
  )
  expect(resolve(doc).verificationStatus).toBe('verified')
  expect(resolve(doc).diagnostics.some((d) => d.code === 'HOT_GROUND_SHORT')).toBe(false)
  extra.controlState = 'bridge'
  expect(resolve(doc).outputObservations['jack:tip'].state).toBe('muted')
})
