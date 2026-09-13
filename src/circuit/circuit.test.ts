import { describe, expect, it } from 'vitest'
import type { ControlState } from './model'
import { resolve } from './resolver'
import { starterDocument } from './template'

const full = (selector: ControlState['selector']): ControlState => ({
  selector,
  neckVolume: 'full',
  bridgeVolume: 'full',
  tone: 'full',
})

describe('verified starter resolver', () => {
  it.each([
    ['neck', true, false],
    ['middle', true, true],
    ['bridge', false, true],
  ] as const)('resolves %s selector state', (selector, neck, bridge) => {
    const result = resolve(starterDocument(), full(selector))
    expect(result.diagnostics).toEqual([])
    expect(result.buildReady).toBe(true)
    expect(result.paths.find((path) => path.pickup === 'neck')?.active).toBe(neck)
    expect(result.paths.find((path) => path.pickup === 'bridge')?.active).toBe(bridge)
  })

  it('contains two independent 500k volume controls and a master tone branch', () => {
    const document = starterDocument()
    expect(
      document.instances.filter(
        (item) => item.definitionId === 'pot-500k-audio' && item.values.control?.includes('volume'),
      ),
    ).toHaveLength(2)
    expect(document.instances.find((item) => item.id === 'tone')?.values).toMatchObject({
      resistance: '500k',
      taper: 'audio',
      control: 'tone',
    })
    expect(document.instances.find((item) => item.id === 'cap')?.values.capacitance).toBe('22nF')
  })

  it('shows intentional zero-volume muting without reporting a hard short', () => {
    const result = resolve(starterDocument(), {
      ...full('neck'),
      neckVolume: 'zero',
    })
    expect(result.outputMuted).toBe(true)
    expect(result.paths.every((path) => !path.active)).toBe(true)
    expect(result.diagnostics.map((item) => item.code)).not.toContain('HOT_GROUND_SHORT')
    expect(result.buildReady).toBe(true)
  })

  it('finds a broken selected signal path and blocks output', () => {
    const document = starterDocument()
    document.wires = document.wires.filter((wire) => wire.id !== 'w01')
    const result = resolve(document, full('neck'))
    expect(result.diagnostics.map((item) => item.code)).toContain('STARTER_WIRE_MISSING')
    expect(result.diagnostics.map((item) => item.code)).toContain('OPEN_SIGNAL')
    expect(result.buildReady).toBe(false)
  })

  it('finds open grounds, missing shield bonds and hard shorts', () => {
    const openGround = starterDocument()
    openGround.wires = openGround.wires.filter((wire) => wire.id !== 'w09')
    expect(resolve(openGround).diagnostics.map((item) => item.code)).toContain('OPEN_GROUND')

    const openShield = starterDocument()
    openShield.wires = openShield.wires.filter((wire) => wire.id !== 'w10')
    expect(resolve(openShield).diagnostics.map((item) => item.code)).toContain('OPEN_GROUND')

    const shorted = starterDocument()
    shorted.wires.push({
      id: 'short',
      from: 'jack:tip',
      to: 'jack:sleeve',
      role: 'signal',
      color: '#ff0000',
      label: '',
      waypoints: [],
    })
    expect(resolve(shorted).diagnostics.map((item) => item.code)).toContain('HOT_GROUND_SHORT')
  })

  it('blocks unknown pinout ids and incorrect starter wire roles', () => {
    const unknownPinout = starterDocument()
    unknownPinout.instances[0].pinoutId = 'not-a-known-pinout'
    const pinoutResult = resolve(unknownPinout)
    expect(pinoutResult.diagnostics.map((item) => item.code)).toContain('UNKNOWN_PINOUT')
    expect(pinoutResult.buildReady).toBe(false)

    const wrongRole = starterDocument()
    wrongRole.wires.find((wire) => wire.id === 'w10')!.role = 'ground'
    const roleResult = resolve(wrongRole)
    expect(roleResult.diagnostics.map((item) => item.code)).toContain('STARTER_WIRE_ROLE')
    expect(roleResult.buildReady).toBe(false)
  })

  it('excludes the reactive tone branch from false DC short analysis', () => {
    const result = resolve(starterDocument())
    expect(result.diagnostics.map((item) => item.code)).not.toContain('HOT_GROUND_SHORT')
    expect(result.activeWireIds).toEqual(
      expect.arrayContaining(['w01', 'w02', 'w03', 'w04', 'w05']),
    )
    expect(result.activeWireIds).not.toContain('w06')
  })
})
