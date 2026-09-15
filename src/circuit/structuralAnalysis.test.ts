import { describe, expect, it } from 'vitest'
import { DEFAULT_CONTROLS } from './model'
import { resolve } from './structuralAnalysis'
import {
  fiveWaySingleCoilDocument,
  masterVolumeDocument,
  seriesParallelDocument,
  splitDocument,
  starterDocument,
} from './template'

describe('structural-analysis candidate', () => {
  it('keeps every shipped preset structurally valid while allowing a live zero volume mute', () => {
    expect(resolve(starterDocument(), DEFAULT_CONTROLS).structuralStatus).toBe('valid')
    expect(resolve(masterVolumeDocument(), DEFAULT_CONTROLS).structuralStatus).toBe('valid')
    expect(resolve(fiveWaySingleCoilDocument(), DEFAULT_CONTROLS).structuralStatus).toBe('valid')
    expect(resolve(seriesParallelDocument(), DEFAULT_CONTROLS).structuralStatus).toBe('valid')
    for (const kind of ['push-pull-dpdt', 'push-push-dpdt'] as const) {
      expect(resolve(splitDocument(kind), DEFAULT_CONTROLS).structuralStatus).toBe('valid')
    }
    expect(
      resolve(starterDocument(), { ...DEFAULT_CONTROLS, neckVolume: 'zero', selector: 'neck' })
        .outputMuted,
    ).toBe(true)
  })

  it('maps the five-way preset and keeps the DPDT parallel and series nets distinct', () => {
    const fiveWay = resolve(fiveWaySingleCoilDocument(), DEFAULT_CONTROLS)
    expect(fiveWay.functionTable.map((row) => row.sources.sort())).toEqual([
      ['neck'],
      ['middle', 'neck'].sort(),
      ['middle'],
      ['bridge', 'middle'].sort(),
      ['bridge'],
    ])
    const seriesParallel = seriesParallelDocument()
    const parallel = resolve(seriesParallel, DEFAULT_CONTROLS).functionTable
    expect(parallel).toHaveLength(2)
    expect(parallel.every((row) => row.sources.length === 2 && !row.unknown)).toBe(true)
    const pairs = new Set(seriesParallel.wires.map((wire) => [wire.from, wire.to].sort().join('|')))
    expect(pairs.has('ground:node|series-parallel:a1')).toBe(true)
    expect(pairs.has('master-volume:in|series-parallel:b1')).toBe(true)
    expect(pairs.has('series-parallel:a3|series-parallel:b3')).toBe(true)
    expect(pairs.has('ground:node|series-parallel:a3')).toBe(false)
    expect(pairs.has('master-volume:in|series-parallel:b3')).toBe(false)
    expect(resolve(seriesParallel, { ...DEFAULT_CONTROLS, masterVolume: 'zero' }).outputMuted).toBe(
      true,
    )
  })
})
