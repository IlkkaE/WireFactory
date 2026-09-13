import { definition } from './catalog'
import {
  DEFAULT_CONTROLS,
  splitTerminalKey,
  terminalKey,
  type ControlState,
  type SelectorState,
  type WireFactoryDocument,
} from './model'

export type Severity = 'error' | 'warning'
export interface Diagnostic {
  code: string
  severity: Severity
  message: string
  terminals: string[]
}
export interface SignalPath {
  pickup: 'neck' | 'bridge'
  selector: SelectorState
  selected: boolean
  active: boolean
  muted: boolean
  terminals: string[]
  wireIds: string[]
}
export interface FunctionRow {
  selector: SelectorState
  neck: boolean
  bridge: boolean
}
export interface ResolvedCircuit {
  diagnostics: Diagnostic[]
  paths: SignalPath[]
  functionTable: FunctionRow[]
  activeTerminals: string[]
  activeWireIds: string[]
  buildReady: boolean
  incomplete: boolean
  outputMuted: boolean
}

interface Edge {
  node: string
  id: string
}
type Graph = Map<string, Edge[]>

const addEdge = (graph: Graph, from: string, to: string, id: string) => {
  graph.set(from, [...(graph.get(from) ?? []), { node: to, id }])
  graph.set(to, [...(graph.get(to) ?? []), { node: from, id }])
}

const findPath = (graph: Graph, start: string, target: string) => {
  const queue = [start]
  const previous = new Map<string, { node: string; edgeId: string }>([
    [start, { node: '', edgeId: '' }],
  ])
  while (queue.length) {
    const node = queue.shift()!
    if (node === target) break
    for (const edge of graph.get(node) ?? []) {
      if (previous.has(edge.node)) continue
      previous.set(edge.node, { node, edgeId: edge.id })
      queue.push(edge.node)
    }
  }
  if (!previous.has(target)) return null
  const terminals: string[] = []
  const edgeIds: string[] = []
  let cursor = target
  while (cursor) {
    terminals.unshift(cursor)
    const step = previous.get(cursor)
    if (!step?.node) break
    edgeIds.unshift(step.edgeId)
    cursor = step.node
  }
  return { terminals, edgeIds }
}

const pair = (from: string, to: string) => [from, to].sort().join('|')
const EXPECTED_DEFINITIONS: Record<string, string> = {
  neck: 'hb-2c-braid',
  bridge: 'hb-2c-braid',
  'neck-volume': 'pot-500k-audio',
  'bridge-volume': 'pot-500k-audio',
  selector: 'three-way-toggle',
  tone: 'pot-500k-audio',
  cap: 'capacitor',
  jack: 'mono-jack',
  ground: 'junction',
}
const EXPECTED_CONNECTIONS = [
  ['neck:hot', 'neck-volume:in', 'signal'],
  ['neck-volume:out', 'selector:neck', 'signal'],
  ['bridge:hot', 'bridge-volume:in', 'signal'],
  ['bridge-volume:out', 'selector:bridge', 'signal'],
  ['selector:common', 'jack:tip', 'signal'],
  ['selector:common', 'tone:in', 'tone'],
  ['tone:out', 'cap:a', 'tone'],
  ['cap:b', 'ground:node', 'ground'],
  ['neck:ground', 'ground:node', 'ground'],
  ['neck:shield', 'ground:node', 'shield'],
  ['bridge:ground', 'ground:node', 'ground'],
  ['bridge:shield', 'ground:node', 'shield'],
  ['neck-volume:ground', 'ground:node', 'ground'],
  ['bridge-volume:ground', 'ground:node', 'ground'],
  ['tone:ground', 'ground:node', 'ground'],
  ['ground:node', 'jack:sleeve', 'ground'],
] as const

const volumeState = (instanceId: string, controls: ControlState) => {
  if (instanceId === 'neck-volume') return controls.neckVolume
  if (instanceId === 'bridge-volume') return controls.bridgeVolume
  return null
}

function buildGraph(
  doc: WireFactoryDocument,
  controls: ControlState,
  options: { includeTone: boolean; includeMute: boolean },
): Graph {
  const graph: Graph = new Map()
  for (const wire of doc.wires) {
    if (!options.includeTone && wire.role === 'tone') continue
    addEdge(graph, wire.from, wire.to, wire.id)
  }
  for (const item of doc.instances) {
    if (item.definitionId === 'three-way-toggle') {
      if (controls.selector !== 'bridge') {
        addEdge(
          graph,
          terminalKey(item.id, 'neck'),
          terminalKey(item.id, 'common'),
          `internal:${item.id}:neck`,
        )
      }
      if (controls.selector !== 'neck') {
        addEdge(
          graph,
          terminalKey(item.id, 'bridge'),
          terminalKey(item.id, 'common'),
          `internal:${item.id}:bridge`,
        )
      }
    }
    const state = volumeState(item.id, controls)
    if (state && state !== 'zero') {
      addEdge(
        graph,
        terminalKey(item.id, 'in'),
        terminalKey(item.id, 'out'),
        `internal:${item.id}:track`,
      )
    } else if (state === 'zero' && options.includeMute) {
      addEdge(
        graph,
        terminalKey(item.id, 'out'),
        terminalKey(item.id, 'ground'),
        `internal:${item.id}:mute`,
      )
    }
  }
  return graph
}

const selectedPickups = (selector: SelectorState) =>
  selector === 'middle' ? new Set(['neck', 'bridge']) : new Set([selector])

function evaluatePaths(doc: WireFactoryDocument, controls: ControlState) {
  const signalGraph = buildGraph(doc, controls, { includeTone: false, includeMute: false })
  const operationalGraph = buildGraph(doc, controls, { includeTone: false, includeMute: true })
  const jackTip = terminalKey('jack', 'tip')
  const sleeve = terminalKey('jack', 'sleeve')
  const selected = selectedPickups(controls.selector)
  const outputMuted = Boolean(findPath(operationalGraph, jackTip, sleeve))
  const paths = (['neck', 'bridge'] as const).map((pickup): SignalPath => {
    const route = findPath(signalGraph, terminalKey(pickup, 'hot'), jackTip)
    const isSelected = selected.has(pickup)
    return {
      pickup,
      selector: controls.selector,
      selected: isSelected,
      active: Boolean(route && isSelected && !outputMuted),
      muted: Boolean(isSelected && outputMuted),
      terminals: route?.terminals ?? [terminalKey(pickup, 'hot'), jackTip],
      wireIds: route?.edgeIds.filter((id) => !id.startsWith('internal:')) ?? [],
    }
  })
  return { paths, outputMuted }
}

const push = (
  diagnostics: Diagnostic[],
  code: string,
  message: string,
  terminals: string[] = [],
  severity: Severity = 'error',
) => diagnostics.push({ code, severity, message, terminals })

export function resolve(
  doc: WireFactoryDocument,
  controls: ControlState = DEFAULT_CONTROLS,
): ResolvedCircuit {
  const diagnostics: Diagnostic[] = []
  const terminalKeys = new Set<string>()
  const instanceIds = new Set<string>()
  for (const instance of doc.instances) {
    if (instanceIds.has(instance.id)) {
      push(diagnostics, 'DUPLICATE_INSTANCE', `Duplicate component id: ${instance.id}`)
    }
    instanceIds.add(instance.id)
    const item = definition(instance.definitionId)
    if (
      !item ||
      instance.definitionVersion !== 1 ||
      instance.pinoutVersion !== 1 ||
      instance.pinoutId !== `${instance.definitionId}-generic`
    ) {
      push(
        diagnostics,
        'UNKNOWN_PINOUT',
        `Unknown component definition or pinout: ${instance.definitionId}`,
      )
      continue
    }
    for (const terminal of item.terminals) {
      terminalKeys.add(terminalKey(instance.id, terminal.id))
    }
    if (
      !Number.isFinite(instance.x) ||
      !Number.isFinite(instance.y) ||
      Math.abs(instance.x) > 10_000 ||
      Math.abs(instance.y) > 10_000
    ) {
      push(diagnostics, 'INVALID_COORDINATE', `Invalid location: ${instance.label}`)
    }
  }

  const wireIds = new Set<string>()
  const wirePairs = new Map<string, WireFactoryDocument['wires'][number]>()
  for (const wire of doc.wires) {
    if (wireIds.has(wire.id)) {
      push(diagnostics, 'DUPLICATE_WIRE', `Duplicate wire id: ${wire.id}`, [wire.from, wire.to])
    }
    wireIds.add(wire.id)
    if (!terminalKeys.has(wire.from) || !terminalKeys.has(wire.to) || wire.from === wire.to) {
      push(diagnostics, 'INVALID_ENDPOINT', 'Wire endpoint is missing or invalid.', [
        wire.from,
        wire.to,
      ])
    }
    const key = pair(wire.from, wire.to)
    if (wirePairs.has(key)) {
      push(diagnostics, 'DUPLICATE_CONNECTION', 'The same connection exists twice.', [
        wire.from,
        wire.to,
      ])
    }
    wirePairs.set(key, wire)
  }

  if (doc.expectation?.id !== 'starter-2hb-2v-1t' || doc.expectation.version !== 1) {
    push(
      diagnostics,
      'TEMPLATE_MISMATCH',
      'Build-ready validation is available only for the verified 2HB / 2V / 1T starter.',
    )
  } else {
    const exactComponents =
      doc.instances.length === Object.keys(EXPECTED_DEFINITIONS).length &&
      Object.entries(EXPECTED_DEFINITIONS).every(([id, definitionId]) =>
        doc.instances.some((item) => item.id === id && item.definitionId === definitionId),
      )
    if (!exactComponents) {
      push(
        diagnostics,
        'TEMPLATE_COMPONENTS',
        'Starter components or their roles no longer match the verified template.',
      )
    }
    for (const [from, to, role] of EXPECTED_CONNECTIONS) {
      const wire = wirePairs.get(pair(from, to))
      if (!wire) {
        push(
          diagnostics,
          'STARTER_WIRE_MISSING',
          `Required starter connection is missing: ${pair(from, to)}`,
          [from, to],
        )
      } else if (wire.role !== role) {
        push(
          diagnostics,
          'STARTER_WIRE_ROLE',
          `Connection ${pair(from, to)} must have role ${role}.`,
          [from, to],
        )
      }
    }
    if (wirePairs.size !== EXPECTED_CONNECTIONS.length) {
      push(
        diagnostics,
        'STARTER_WIRE_COUNT',
        'The verified starter must contain exactly the expected connections.',
      )
    }
  }

  const fullControls: ControlState = {
    ...DEFAULT_CONTROLS,
    neckVolume: 'full',
    bridgeVolume: 'full',
  }
  const groundGraph = buildGraph(doc, fullControls, { includeTone: false, includeMute: false })
  const sleeve = terminalKey('jack', 'sleeve')
  for (const key of [
    'neck:ground',
    'neck:shield',
    'bridge:ground',
    'bridge:shield',
    'neck-volume:ground',
    'bridge-volume:ground',
    'tone:ground',
  ]) {
    if (!findPath(groundGraph, key, sleeve)) {
      push(diagnostics, 'OPEN_GROUND', `Ground path is open: ${key}`, [key, sleeve])
    }
  }

  const hardShortGraph = buildGraph(doc, fullControls, {
    includeTone: false,
    includeMute: false,
  })
  const jackTip = terminalKey('jack', 'tip')
  if (findPath(hardShortGraph, jackTip, sleeve)) {
    push(
      diagnostics,
      'HOT_GROUND_SHORT',
      'Jack tip is shorted to sleeve outside an intentional zero-volume state.',
      [jackTip, sleeve],
    )
  }
  const tipWires = doc.wires.filter((wire) => wire.from === jackTip || wire.to === jackTip)
  const sleeveWires = doc.wires.filter((wire) => wire.from === sleeve || wire.to === sleeve)
  if (
    tipWires.some((wire) => wire.role === 'ground' || wire.role === 'shield') ||
    sleeveWires.some((wire) => wire.role === 'signal')
  ) {
    push(diagnostics, 'JACK_SWAP', 'Jack tip and sleeve roles appear to be swapped.', [
      jackTip,
      sleeve,
    ])
  }

  const functionTable: FunctionRow[] = (['neck', 'middle', 'bridge'] as const).map((selector) => {
    const evaluated = evaluatePaths(doc, { ...fullControls, selector })
    return {
      selector,
      neck: evaluated.paths.find((path) => path.pickup === 'neck')?.active ?? false,
      bridge: evaluated.paths.find((path) => path.pickup === 'bridge')?.active ?? false,
    }
  })
  const expectedFunctions: Record<SelectorState, [boolean, boolean]> = {
    neck: [true, false],
    middle: [true, true],
    bridge: [false, true],
  }
  for (const row of functionTable) {
    const [neckExpected, bridgeExpected] = expectedFunctions[row.selector]
    if (row.neck !== neckExpected || row.bridge !== bridgeExpected) {
      push(
        diagnostics,
        row.neck || row.bridge ? 'LEAKAGE' : 'OPEN_SIGNAL',
        `Selector state ${row.selector} does not produce the expected pickup paths.`,
      )
    }
  }

  const incomplete = doc.instances.length > 80 || doc.wires.length > 180
  if (incomplete) {
    push(
      diagnostics,
      'ANALYSIS_LIMIT',
      'State analysis limit reached; the result is incomplete.',
      [],
      'warning',
    )
  }
  const current = evaluatePaths(doc, controls)
  const activeTerminals = Array.from(
    new Set(current.paths.filter((path) => path.active).flatMap((path) => path.terminals)),
  )
  const activeWireIds = Array.from(
    new Set(current.paths.filter((path) => path.active).flatMap((path) => path.wireIds)),
  )
  const buildReady =
    !incomplete && diagnostics.every((diagnostic) => diagnostic.severity !== 'error')
  return {
    diagnostics,
    paths: current.paths,
    functionTable,
    activeTerminals,
    activeWireIds,
    buildReady,
    incomplete,
    outputMuted: current.outputMuted,
  }
}

export const terminalInstanceId = (terminal: string) => splitTerminalKey(terminal)[0]
