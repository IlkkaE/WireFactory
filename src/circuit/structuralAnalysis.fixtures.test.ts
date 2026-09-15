import { describe, expect, it } from 'vitest'
import { DEFAULT_CONTROLS, type Instance, type WireFactoryDocument } from './model'
import { resolve } from './structuralAnalysis'

const part = (id: string, definitionId: string): Instance => ({
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
const circuit = (instances: Instance[], ends: [string, string][]): WireFactoryDocument => ({
  format: 'wirefactory-project',
  version: 1,
  title: 'fixture',
  instances,
  wires: ends.map(([from, to], index) => ({
    id: 'w' + index,
    from,
    to,
    role: 'signal',
    color: '#fff',
    label: '',
    waypoints: [],
  })),
  junctions: [],
  expectation: null,
})

describe('general structural-analysis fixtures', () => {
  it('accepts a renamed direct single pickup to a mono output without an expectation', () => {
    const pickup = { ...part('renamed-source', 'single-coil'), label: 'Any pickup ID is fine' }
    const result = resolve(
      circuit(
        [pickup, part('output', 'mono-jack')],
        [
          ['renamed-source:hot', 'output:tip'],
          ['renamed-source:ground', 'output:sleeve'],
        ],
      ),
    )
    expect(result.structuralStatus).toBe('valid')
    expect(result.expectationStatus).toBe('none')
    expect(result.functionTable[0].outputs['output:tip'].sources).toEqual(['renamed-source'])
  })

  it('does not treat a one-ended ground spur as pickup contribution', () => {
    const result = resolve(
      circuit(
        [part('pickup', 'single-coil'), part('volume', 'pot-500k-audio'), part('out', 'mono-jack')],
        [
          ['pickup:hot', 'volume:ground'],
          ['volume:ground', 'out:sleeve'],
        ],
      ),
    )
    expect(result.structuralStatus).toBe('invalid')
    expect(result.diagnostics.some((entry) => entry.code === 'NO_VIABLE_OUTPUT')).toBe(true)
  })

  it('keeps a kill state muted while another state makes the document valid', () => {
    const result = resolve(
      circuit(
        [part('pickup', 'single-coil'), part('kill', 'spst-on-off'), part('out', 'mono-jack')],
        [
          ['pickup:hot', 'out:tip'],
          ['pickup:ground', 'out:sleeve'],
          ['kill:a', 'out:tip'],
          ['kill:b', 'out:sleeve'],
        ],
      ),
    )
    expect(result.structuralStatus).toBe('valid')
    expect(result.functionTable.some((row) => row.muted)).toBe(true)
    expect(result.functionTable.some((row) => !row.muted)).toBe(true)
  })

  it('reports an exclusive humbucker coil join as series and exposes both output probes', () => {
    const result = resolve(
      circuit(
        [part('hb', 'hb-4c-shield'), part('out', 'mono-jack')],
        [
          ['hb:north-start', 'out:tip'],
          ['hb:north-finish', 'hb:south-start'],
          ['hb:south-finish', 'out:sleeve'],
        ],
      ),
      DEFAULT_CONTROLS,
    )
    expect(result.structuralStatus).toBe('valid')
    expect(result.paths[0].coilMode).toBe('series')
    expect(result.coilInfluence[0].outputs['out:tip']).toMatchObject({
      highLoad: expect.any(Number),
      lowLoad: expect.any(Number),
    })
  })
})
