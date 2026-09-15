import { describe, it, expect } from 'vitest'
import { catalog, definition } from './catalog'
import { resolve } from './resolver'
import { type Instance, type WireFactoryDocument } from './model'
const p = (id: string, definitionId: string): Instance => ({
  id,
  definitionId,
  definitionVersion: 1,
  pinoutId: definitionId + '-generic',
  pinoutVersion: 1,
  values: {},
  x: 0,
  y: 0,
  rotation: 0,
  label: id,
})
const doc = (instances: Instance[], ends: string[]): WireFactoryDocument => ({
  format: 'wirefactory-project',
  version: 1,
  title: 'Independent circuit',
  expectation: null,
  junctions: [],
  instances,
  wires: ends.map((edge, i) => {
    const [from, to] = edge.split(' ')
    return { id: 'w' + i, from, to, role: 'signal', color: '#ffffff', label: '', waypoints: [] }
  }),
})
const direct = () =>
  doc(
    [p('arbitrary', 'single-coil'), p('out', 'mono-jack')],
    ['arbitrary:hot out:tip', 'arbitrary:ground out:sleeve'],
  )
describe('independent structural cases', () => {
  it('models every catalog entry explicitly', () => {
    for (const d of catalog) expect(d.electricalModel, d.id).toBeDefined()
  })
  it('finds all three sources across five blade positions', () => {
    const d = doc(
      [
        p('red', 'single-coil'),
        p('green', 'p90'),
        p('blue', 'single-coil'),
        p('route', 'five-way-blade'),
        p('out', 'mono-jack'),
      ],
      [
        'red:hot route:a1',
        'green:hot route:a2',
        'blue:hot route:a3',
        'route:a0 out:tip',
        'red:ground out:sleeve',
        'green:ground out:sleeve',
        'blue:ground out:sleeve',
      ],
    )
    const r = resolve(d)
    expect(r.structuralStatus).toBe('valid')
    expect(r.functionTable.map((row) => row.sources)).toEqual([
      ['red'],
      ['red', 'green'],
      ['green'],
      ['green', 'blue'],
      ['blue'],
    ])
  })
  it('accepts series pickups with a floating cold and reversed source leads', () => {
    const d = doc(
      [p('one', 'single-coil'), p('two', 'p90'), p('out', 'mono-jack')],
      ['one:ground out:tip', 'one:hot two:hot', 'two:ground out:sleeve'],
    )
    const r = resolve(d)
    expect(r.buildReady).toBe(true)
    expect(r.paths.filter((x) => x.active).map((x) => x.pickup)).toEqual(['one', 'two'])
  })
  it('allows capacitive series coupling and optional disconnected parts', () => {
    const d = direct()
    d.instances.push(p('cap', 'capacitor'), p('unused', 'resistor'))
    d.wires[0].to = 'cap:a'
    d.wires.push({ ...d.wires[0], id: 'to-output', from: 'cap:b', to: 'out:tip' })
    expect(resolve(d).structuralStatus).toBe('valid')
  })
  it('does not activate an unselected source through its grounded cold or pot return', () => {
    const d = direct()
    d.instances.push(p('unselected', 'single-coil'), p('pot', 'pot-250k-audio'))
    d.wires.push(
      { ...d.wires[0], id: 'cold', from: 'unselected:ground', to: 'out:sleeve' },
      { ...d.wires[0], id: 'spur', from: 'pot:ground', to: 'out:sleeve' },
    )
    const r = resolve(d)
    expect(r.paths.filter((p) => p.active).map((p) => p.pickup)).toEqual(['arbitrary'])
    expect(r.diagnostics.some((x) => x.code === 'INACTIVE_PICKUP')).toBe(true)
  })
  it.each(['parallel', 'split', 'complex'] as const)(
    'classifies HB4 %s without a preset',
    (mode) => {
      const base = ['hb:north-start out:tip', 'hb:north-finish out:sleeve']
      const ends =
        mode === 'parallel'
          ? [...base, 'hb:south-start out:tip', 'hb:south-finish out:sleeve']
          : mode === 'split'
            ? [...base, 'hb:south-start out:sleeve', 'hb:south-finish out:sleeve']
            : [...base, 'hb:south-start out:ring', 'hb:south-finish out:sleeve']
      const r = resolve(
        doc(
          [p('hb', 'hb-4c-shield'), p('out', mode === 'complex' ? 'stereo-jack' : 'mono-jack')],
          ends,
        ),
      )
      expect(r.structuralStatus).toBe('valid')
      expect(r.paths[0].coilMode).toBe(mode)
      if (mode === 'complex')
        expect(Object.keys(r.outputObservations)).toEqual(['out:tip', 'out:ring'])
    },
  )
  it('accepts a series coil join through a junction node', () => {
    const r = resolve(
      doc(
        [p('hb', 'hb-4c-shield'), p('join', 'junction'), p('out', 'mono-jack')],
        [
          'hb:north-start out:tip',
          'hb:north-finish join:node',
          'join:node hb:south-finish',
          'hb:south-start out:sleeve',
        ],
      ),
    )
    expect(r.buildReady).toBe(true)
    expect(r.paths[0].coilMode).toBe('series')
  })
  it('distinguishes open output from a permanent ideal short', () => {
    const d = direct()
    d.wires = []
    expect(resolve(d).outputObservations['out:tip'].state).toBe('open')
    expect(resolve(d).outputMuted).toBe(false)
    d.wires = direct().wires
    d.wires.push({ ...d.wires[0], id: 'short', from: 'out:tip', to: 'out:sleeve' })
    expect(resolve(d).outputObservations['out:tip'].state).toBe('muted')
    expect(resolve(d).buildReady).toBe(false)
  })
  it('bounds contact state explosion', () => {
    const d = direct()
    for (let i = 0; i < 10; i++) d.instances.push(p('s' + i, 'spst-on-off'))
    const r = resolve(d)
    expect(r.structuralStatus).toBe('unknown')
    expect(r.incomplete).toBe(true)
    expect(r.buildReady).toBe(false)
  })
  it('refuses an electrically connected component without a model', () => {
    const d = direct(),
      part = definition('resistor')!,
      saved = part.electricalModel
    try {
      delete part.electricalModel
      d.instances.push(p('r', 'resistor'))
      d.wires.push({ ...d.wires[0], id: 'extra', from: 'r:a', to: 'out:tip' })
      expect(resolve(d).structuralStatus).toBe('unknown')
    } finally {
      part.electricalModel = saved
    }
  })
  it('reports probe disagreement on a balanced bridge as unknown', () => {
    const d = doc(
      [
        p('source', 'single-coil'),
        p('out', 'mono-jack'),
        ...['a', 'b', 'c', 'd'].map((id) => p(id, 'resistor')),
      ],
      [
        'source:hot a:a',
        'source:hot c:a',
        'source:ground b:b',
        'source:ground d:b',
        'a:b b:a',
        'a:b out:tip',
        'c:b d:a',
        'c:b out:sleeve',
      ],
    )
    expect(resolve(d).structuralStatus).toBe('unknown')
  })
})
