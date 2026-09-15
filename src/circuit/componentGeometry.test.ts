import { describe, expect, it } from 'vitest'
import { catalog, definition } from './catalog'
import { componentGeometry, terminalPosition } from './componentGeometry'
import { parseProject, stringifyProject } from './file'
import { DEFAULT_CONTROLS } from './model'
import { resolve } from './resolver'
import { splitDocument } from './template'

describe('component geometry and dual split templates', () => {
  it('gives every canonical catalog terminal a unique in-bounds visible anchor', () => {
    for (const item of catalog) {
      const instance = {
        id: item.id,
        definitionId: item.id,
        definitionVersion: 1 as const,
        pinoutId: item.id + '-generic',
        pinoutVersion: 1 as const,
        values: {},
        x: 20,
        y: 30,
        rotation: 0,
        label: item.name,
      }
      const geometry = componentGeometry(instance)
      expect(geometry.svg).toContain('component-art')
      const points = Object.values(geometry.terminals)
      expect(points).toHaveLength(item.terminals.length)
      expect(new Set(points.map((point) => point.x + ':' + point.y)).size).toBe(points.length)
      for (const point of points) {
        expect(point.x).toBeGreaterThanOrEqual(0)
        expect(point.x).toBeLessThanOrEqual(geometry.width)
        expect(point.y).toBeGreaterThanOrEqual(0)
        expect(point.y).toBeLessThanOrEqual(geometry.height)
      }
    }
  })
  it('has explicit contacts for five-way overlap and every switch state', () => {
    for (const item of catalog.filter((entry) => entry.category === 'Switches'))
      if (item.contactModel) expect(item.contactModel.states.length).toBeGreaterThan(0)
    const five = definition('five-way-blade')!.contactModel!
    expect(five.states.find((state) => state.id === 'two')!.pairs).toContainEqual(['a0', 'a1'])
    expect(five.states.find((state) => state.id === 'two')!.pairs).toContainEqual(['a0', 'a2'])
  })
  it.each(['push-pull-dpdt', 'push-push-dpdt'] as const)(
    'verifies %s dual split in full and split states and persists it',
    (kind) => {
      const doc = splitDocument(kind)
      for (const selector of ['neck', 'middle', 'bridge'] as const) {
        const current = resolve(doc, { ...DEFAULT_CONTROLS, selector })
        expect(current.buildReady).toBe(true)
        expect(current.paths.filter((path) => path.active)).toHaveLength(
          selector === 'middle' ? 2 : 1,
        )
      }
      expect(resolve(doc, { ...DEFAULT_CONTROLS, masterVolume: 'zero' }).outputMuted).toBe(true)
      doc.instances.find((item) => item.id === 'tone')!.controlState = 'split'
      expect(resolve(doc, DEFAULT_CONTROLS).buildReady).toBe(true)
      const opened = parseProject(stringifyProject(doc))
      expect(opened.instances.find((item) => item.id === 'tone')!.controlState).toBe('split')
      opened.wires = opened.wires.filter((wire) => wire.id !== 'w19')
      expect(resolve(opened, DEFAULT_CONTROLS).expectationStatus).toBe('deviated')
      expect(terminalPosition(doc, 'tone:a2')).not.toBeNull()
    },
  )
})
