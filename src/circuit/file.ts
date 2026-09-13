import { definition } from './catalog'
import {
  FORMAT,
  VERSION,
  terminalKey,
  type Instance,
  type Wire,
  type WireFactoryDocument,
} from './model'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))

const requireString = (value: unknown, label: string) => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 200) {
    throw new Error(`${label} must be a non-empty string.`)
  }
  return value
}

function parseInstance(value: unknown): Instance {
  if (!isRecord(value)) throw new Error('Every component must be an object.')
  const id = requireString(value.id, 'Component id')
  const definitionId = requireString(value.definitionId, 'Definition id')
  const item = definition(definitionId)
  const expectedPinoutId = `${definitionId}-generic`
  if (
    !item ||
    value.definitionVersion !== 1 ||
    value.pinoutVersion !== 1 ||
    value.pinoutId !== expectedPinoutId
  ) {
    throw new Error(`Unknown component definition or pinout: ${definitionId}`)
  }
  if (
    typeof value.x !== 'number' ||
    typeof value.y !== 'number' ||
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y) ||
    Math.abs(value.x) > 10_000 ||
    Math.abs(value.y) > 10_000
  ) {
    throw new Error(`Invalid component coordinates: ${id}`)
  }
  if (!isRecord(value.values)) throw new Error(`Invalid component values: ${id}`)
  return {
    id,
    definitionId,
    definitionVersion: 1,
    pinoutId: expectedPinoutId,
    pinoutVersion: 1,
    label: requireString(value.label, 'Component label'),
    values: Object.fromEntries(
      Object.entries(value.values).map(([key, entry]) => [key, String(entry)]),
    ),
    x: value.x,
    y: value.y,
    rotation:
      typeof value.rotation === 'number' && Number.isFinite(value.rotation) ? value.rotation : 0,
    ...(typeof value.controlState === 'string' ? { controlState: value.controlState } : {}),
  }
}

function parseWire(value: unknown): Wire {
  if (!isRecord(value)) throw new Error('Every wire must be an object.')
  const role = value.role
  if (!['signal', 'ground', 'tone', 'shield'].includes(String(role))) {
    throw new Error(`Invalid wire role: ${String(role)}`)
  }
  const waypoints = Array.isArray(value.waypoints)
    ? value.waypoints.map((point) => {
        if (
          !isRecord(point) ||
          typeof point.x !== 'number' ||
          typeof point.y !== 'number' ||
          !Number.isFinite(point.x) ||
          !Number.isFinite(point.y)
        ) {
          throw new Error('Invalid wire waypoint.')
        }
        return { x: point.x, y: point.y }
      })
    : []
  return {
    id: requireString(value.id, 'Wire id'),
    from: requireString(value.from, 'Wire start'),
    to: requireString(value.to, 'Wire end'),
    role: role as Wire['role'],
    color: typeof value.color === 'string' ? value.color : '#f0b35a',
    label: typeof value.label === 'string' ? value.label : '',
    waypoints,
  }
}

export function parseProject(text: string): WireFactoryDocument {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('Project file is not valid JSON.')
  }
  if (!isRecord(value)) throw new Error('Project file must be an object.')
  if (value.format !== FORMAT || value.version !== VERSION) {
    throw new Error('Unsupported .wirefactory format or version.')
  }
  if (!Array.isArray(value.instances) || !Array.isArray(value.wires)) {
    throw new Error('Project components and wires must be arrays.')
  }
  if (value.instances.length > 80 || value.wires.length > 180) {
    throw new Error('Project exceeds v1 safety limits.')
  }
  const instances = value.instances.map(parseInstance)
  const wires = value.wires.map(parseWire)
  const instanceIds = new Set<string>()
  const terminals = new Set<string>()
  for (const instance of instances) {
    if (instanceIds.has(instance.id)) throw new Error(`Duplicate component id: ${instance.id}`)
    instanceIds.add(instance.id)
    for (const terminal of definition(instance.definitionId)!.terminals) {
      terminals.add(terminalKey(instance.id, terminal.id))
    }
  }
  const wireIds = new Set<string>()
  for (const wire of wires) {
    if (wireIds.has(wire.id)) throw new Error(`Duplicate wire id: ${wire.id}`)
    wireIds.add(wire.id)
    if (!terminals.has(wire.from) || !terminals.has(wire.to) || wire.from === wire.to) {
      throw new Error(`Invalid wire endpoint: ${wire.id}`)
    }
  }
  const expectation = value.expectation
  if (
    expectation !== null &&
    (!isRecord(expectation) || expectation.id !== 'starter-2hb-2v-1t' || expectation.version !== 1)
  ) {
    throw new Error('Unknown circuit expectation.')
  }
  const junctions = Array.isArray(value.junctions)
    ? value.junctions.map((junction) => {
        if (
          !isRecord(junction) ||
          typeof junction.id !== 'string' ||
          typeof junction.x !== 'number' ||
          typeof junction.y !== 'number'
        ) {
          throw new Error('Invalid junction.')
        }
        return { id: junction.id, x: junction.x, y: junction.y }
      })
    : []
  if (junctions.length > 120) throw new Error('Project exceeds v1 safety limits.')
  return {
    format: FORMAT,
    version: VERSION,
    title: requireString(value.title, 'Project title'),
    instances,
    wires,
    junctions,
    expectation: expectation as WireFactoryDocument['expectation'],
  }
}

export const stringifyProject = (doc: WireFactoryDocument) => JSON.stringify(doc, null, 2)
