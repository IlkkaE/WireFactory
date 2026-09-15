import { beforeEach, describe, it, expect, vi } from 'vitest'
import * as analyzer from './circuit/resolver'
import { useCircuitStore as store } from './store'
import { stringifyProject } from './circuit/file'
const result = () => {
  const s = store.getState()
  return s.checks[analyzer.electricalFingerprint(s.doc, s.controls)]
}
beforeEach(() => {
  vi.restoreAllMocks()
  store.getState().reset()
})
describe('explicit checking lifecycle', () => {
  it('only checks on demand; moving and history do not invoke solver', () => {
    const spy = vi.spyOn(analyzer, 'resolve')
    expect(result()).toBeUndefined()
    store.getState().check()
    const checked = result()
    expect(checked?.buildReady).toBe(true)
    store.getState().move('neck', 150, 250)
    expect(result()).toBe(checked)
    store.getState().undo()
    expect(result()).toBe(checked)
    store.getState().redo()
    expect(result()).toBe(checked)
    expect(spy).toHaveBeenCalledTimes(1)
  })
  it('invalidates electrical edits and restores exact checked state on undo', () => {
    store.getState().check()
    const checked = result()
    store.getState().removeWire('w01')
    expect(result()).toBeUndefined()
    store.getState().undo()
    expect(result()).toBe(checked)
    store.getState().redo()
    expect(result()).toBeUndefined()
    store.getState().check()
    expect(result()?.expectationStatus).toBe('deviated')
  })
  it('invalidates both contact and volume changes', () => {
    store.getState().check()
    store.getState().setControl('selector', 'neck')
    expect(result()).toBeUndefined()
    store.getState().check()
    store.getState().setControl('neckVolume', 'zero')
    expect(result()).toBeUndefined()
    store.getState().check()
    expect(result()?.outputMuted).toBe(true)
    expect(result()?.buildReady).toBe(true)
  })
  it('successful open and presets clear checks; invalid open preserves them', () => {
    store.getState().check()
    const checked = result()
    expect(() => store.getState().open('{}')).toThrow()
    expect(result()).toBe(checked)
    const saved = stringifyProject(store.getState().doc)
    store.getState().open(saved)
    expect(result()).toBeUndefined()
    store.getState().check()
    store.getState().newMasterVolume()
    expect(result()).toBeUndefined()
    store.getState().check()
    store.getState().newSplit('push-pull-dpdt')
    expect(result()).toBeUndefined()
  })
  it('fingerprints ignore geometry and display data but track physical endpoints', () => {
    const s = store.getState(),
      d = structuredClone(s.doc),
      fp = analyzer.electricalFingerprint(d, s.controls)
    d.instances[0].x += 50
    d.instances[0].label = 'new label'
    d.wires[0].color = '#000000'
    d.wires[0].role = 'tone'
    d.wires[0].waypoints = [{ x: 30, y: 40 }]
    expect(analyzer.electricalFingerprint(d, s.controls)).toBe(fp)
    d.wires[0].to = 'jack:tip'
    expect(analyzer.electricalFingerprint(d, s.controls)).not.toBe(fp)
  })
})
