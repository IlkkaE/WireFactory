import { switchStateLabel } from './switchLabels'
// Finite structural probes establish possible source contribution, not an audio response.
import { definition } from './catalog'
import { identifyTopology, topologies, slotTerminal } from './topologies'
import {
  DEFAULT_CONTROLS,
  terminalKey,
  type ControlState,
  type PotState,
  type VerificationStatus,
  type WireFactoryDocument,
} from './model'

export type Severity = 'error' | 'warning'
export type StructuralStatus = 'valid' | 'invalid' | 'unknown'
export type ExpectationStatus = 'matched' | 'deviated' | 'unavailable' | 'none'
export interface Diagnostic {
  code: string
  severity: Severity
  message: string
  terminals: string[]
  title?: string
  suggestion?: string
  componentIds?: string[]
  wireIds?: string[]
  key?: string
}
export interface ProbeAmplitude {
  highLoad: number
  lowLoad: number
}
export interface OutputObservation {
  sources: string[]
  muted: boolean
  unknown: boolean
  state: 'active' | 'muted' | 'open' | 'unknown'
}
export interface SignalPath {
  pickup: string
  selector: string
  selected: boolean
  active: boolean
  muted: boolean
  coilMode?: string
  coilCount?: number
  terminals: string[]
  wireIds: string[]
}
export interface FunctionRow {
  current: boolean
  key: string
  selector: string
  states: Record<string, string>
  sources: string[]
  muted: boolean
  unknown: boolean
  outputs: Record<string, OutputObservation>
  coilModes: Record<string, string>
  neck: boolean
  bridge: boolean
}
export interface CoilInfluence {
  pickup: string
  coil: string
  outputs: Record<string, ProbeAmplitude>
  active: boolean
}
export interface ResolvedCircuit {
  diagnostics: Diagnostic[]
  paths: SignalPath[]
  functionTable: FunctionRow[]
  coilInfluence: CoilInfluence[]
  activeTerminals: string[]
  activeWireIds: string[]
  buildReady: boolean
  incomplete: boolean
  outputMuted: boolean
  verificationStatus: VerificationStatus
  structuralStatus: StructuralStatus
  expectationStatus: ExpectationStatus
  topology: { id: string; name: string } | null
  outputs: string[]
  outputObservations: Record<string, OutputObservation>
}

const EPS = 1e-7,
  SOURCE_R = 6000,
  MAX_COMBOS = 512,
  MAX_NODES = 140,
  MAX_WORK = 35_000_000
const LOADS = { highLoad: 1000003, lowLoad: 470009 }
const add = (
  d: Diagnostic[],
  code: string,
  message: string,
  terminals: string[] = [],
  severity: Severity = 'error',
) => d.push({ code, message, terminals, severity })
const diagnosticDetails: Record<string, { title: string; suggestion: string }> = {
  DUPLICATE_INSTANCE: {
    title: 'Duplicate component ID',
    suggestion: 'Give each component a unique ID before continuing.',
  },
  UNKNOWN_PINOUT: {
    title: 'Component definition is unavailable',
    suggestion: 'Choose a supported component or correct its pinout details.',
  },
  INVALID_SWITCH_STATE: {
    title: 'Switch state is not supported',
    suggestion: 'Choose one of the states defined for this component.',
  },
  DUPLICATE_WIRE: {
    title: 'Duplicate wire ID',
    suggestion: 'Give each wire a unique ID so it can be tracked safely.',
  },
  INVALID_ENDPOINT: {
    title: 'Wire endpoint is invalid',
    suggestion: 'Reconnect this wire to terminals that exist in the current project.',
  },
  DUPLICATE_CONNECTION: {
    title: 'Connection is duplicated',
    suggestion: 'Keep one wire for this connection, then check again.',
  },
  UNMODELED_COMPONENT: {
    title: 'Connected component cannot be analyzed',
    suggestion: 'Use a supported electrical model or verify this part manually.',
  },
  ANALYSIS_LIMIT: {
    title: 'Too many switch combinations',
    suggestion: 'Reduce independently switched states before checking again.',
  },
  ANALYSIS_WORK_LIMIT: {
    title: 'Circuit is too large to analyze here',
    suggestion: 'Simplify the circuit or check smaller sections separately.',
  },
  NO_OUTPUT: {
    title: 'No output jack found',
    suggestion: 'Add a mono or stereo output jack and connect its return path.',
  },
  NO_SOURCE: {
    title: 'No pickup source found',
    suggestion: 'Add a supported pickup source before checking the circuit.',
  },
  ANALYSIS_UNKNOWN: {
    title: 'Circuit result is uncertain',
    suggestion: 'Use a smaller or supported circuit model, then run Check wiring again.',
  },
  NO_VIABLE_OUTPUT: {
    title: 'No pickup reaches an output',
    suggestion: 'Trace the pickup signal path to the output and return connection.',
  },
  EXPECTATION_DEVIATED: {
    title: 'Wiring differs from the saved preset',
    suggestion: 'This is only a preset comparison; review the structural result separately.',
  },
  INACTIVE_PICKUP: {
    title: 'Pickup never reaches an output',
    suggestion: 'Trace this pickup hot and cold path through every switch state.',
  },
  SHIELD_NOT_GROUNDED: {
    title: 'Shield is not on the output return',
    suggestion:
      'Connect this shield to the output return after confirming the pickup wiring diagram.',
  },
  HOT_GROUND_SHORT: {
    title: 'Signal is shorted to return',
    suggestion: 'Separate the highlighted signal and return connections before checking again.',
  },
}
const presentDiagnostics = (doc: WireFactoryDocument, diagnostics: Diagnostic[]) => {
  const components = new Set(doc.instances.map((item) => item.id))
  const terminalOwners = new Map(
    doc.instances.flatMap((item) =>
      (definition(item.definitionId)?.terminals ?? []).map(
        (term) => [terminalKey(item.id, term.id), item.id] as const,
      ),
    ),
  )
  const wires = new Set(doc.wires.map((wire) => wire.id))
  return diagnostics.map((entry, index) => {
    const knownTerminals = [
      ...new Set(entry.terminals.filter((terminal) => terminalOwners.has(terminal))),
    ]
    const componentIds = [
      ...new Set([
        ...(entry.componentIds ?? []),
        ...knownTerminals.map((terminal) => terminalOwners.get(terminal)!),
      ]),
    ].filter((id) => components.has(id))
    const wireIds = [
      ...new Set([
        ...(entry.wireIds ?? []),
        ...doc.wires
          .filter((wire) => knownTerminals.includes(wire.from) || knownTerminals.includes(wire.to))
          .map((wire) => wire.id),
      ]),
    ].filter((id) => wires.has(id))
    const detail = diagnosticDetails[entry.code]
    return {
      ...entry,
      title: detail?.title ?? entry.code,
      suggestion: detail?.suggestion ?? 'Review this result, then run Check wiring again.',
      componentIds,
      terminals: knownTerminals,
      wireIds,
      key: `${entry.code}-${index}`,
    }
  })
}
const pair = (a: string, b: string) => [a, b].sort().join('|')
const scale = (a: string, b: string) => {
  let h = 0
  for (const c of pair(a, b)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return 0.61 + (h % 997) / 997
}
class UF {
  p = new Map<string, string>()
  find(x: string): string {
    if (!this.p.has(x)) this.p.set(x, x)
    const p = this.p.get(x)!
    if (p !== x) this.p.set(x, this.find(p))
    return this.p.get(x)!
  }
  union(a: string, b: string) {
    a = this.find(a)
    b = this.find(b)
    if (a !== b) this.p.set(b, a)
  }
}
type Branch = { a: string; b: string; g: number; alt: number }
type Source = { pickup: string; coil: string; a: string; b: string }
type Output = { id: string; hot: string; cold: string }
type Choice = Record<string, string>
type Network = {
  u: UF
  terminals: Set<string>
  nets: Map<string, string>
  branches: Branch[]
  sources: Source[]
  outputs: Output[]
}
const pot = (state: PotState | null) => (state === 'zero' ? 0 : state === 'full' ? 1 : 0.5)
const potState = (role: string | undefined, c: ControlState): PotState | null =>
  role === 'neck-volume'
    ? c.neckVolume
    : role === 'bridge-volume'
      ? c.bridgeVolume
      : role === 'master-volume'
        ? c.masterVolume
        : role === 'tone'
          ? c.tone
          : null
const switchState = (i: WireFactoryDocument['instances'][number], c: ControlState, x: Choice) =>
  x[i.id] ??
  (i.values.control === 'selector'
    ? c.selector
    : (i.controlState ?? definition(i.definitionId)?.contactModel?.defaultState))
const potR = (id: string) => (id.includes('1m') ? 1000000 : id.includes('250k') ? 250000 : 500000)
const network = (doc: WireFactoryDocument, c: ControlState, choice: Choice = {}): Network => {
  const u = new UF(),
    terminals = new Set<string>()
  for (const i of doc.instances)
    for (const t of definition(i.definitionId)?.terminals ?? []) {
      const k = terminalKey(i.id, t.id)
      terminals.add(k)
      u.find(k)
    }
  for (const w of doc.wires) u.union(w.from, w.to)
  for (const i of doc.instances) {
    const state = definition(i.definitionId)?.contactModel?.states.find(
      (s) => s.id === switchState(i, c, choice),
    )
    for (const [a, b] of state?.pairs ?? []) u.union(terminalKey(i.id, a), terminalKey(i.id, b))
    if (definition(i.definitionId)?.electricalModel === 'potentiometer') {
      const position = potState(i.values.control, c)
      for (const prefix of i.definitionId === 'stacked-pot' ? ['upper-', 'lower-'] : ['']) {
        if (position === 'zero')
          u.union(terminalKey(i.id, prefix + 'out'), terminalKey(i.id, prefix + 'ground'))
        if (position === 'full' && i.definitionId !== 'no-load')
          u.union(terminalKey(i.id, prefix + 'out'), terminalKey(i.id, prefix + 'in'))
      }
    }
  }
  const nets = new Map([...terminals].map((k) => [k, u.find(k)])),
    branches: Branch[] = [],
    sources: Source[] = [],
    outputs: Output[] = []
  const t = (i: WireFactoryDocument['instances'][number], x: string) => terminalKey(i.id, x),
    n = (x: string) => u.find(x),
    branch = (a: string, b: string, r: number) => {
      if (r === 0) return
      const g = 1 / r
      branches.push({ a: n(a), b: n(b), g, alt: g * scale(a, b) })
    }
  for (const i of doc.instances) {
    const d = definition(i.definitionId)
    if (!d) continue
    if (d.electricalModel === 'pickup') {
      for (const q of d.coils ?? [{ id: 'coil', start: 'hot', finish: 'ground' }]) {
        const s = { pickup: i.id, coil: q.id, a: n(t(i, q.start)), b: n(t(i, q.finish)) }
        sources.push(s)
        const g = 1 / SOURCE_R
        branches.push({ a: s.a, b: s.b, g, alt: g * scale(s.a, s.b) })
      }
      continue
    }
    if (d.electricalModel === 'potentiometer') {
      const p = pot(potState(i.values.control, c)),
        r = potR(d.id),
        use = (prefix = '') => {
          if (!(d.id === 'no-load' && p === 1))
            branch(t(i, prefix + 'in'), t(i, prefix + 'out'), r * (1 - p))
          branch(t(i, prefix + 'out'), t(i, prefix + 'ground'), r * p)
        }
      if (d.id === 'stacked-pot') {
        use('upper-')
        use('lower-')
      } else if (d.terminals.some((x) => x.id === 'in')) use()
      continue
    }
    if (d.id === 'capacitor') branch(t(i, 'a'), t(i, 'b'), 100000)
    if (d.id === 'resistor') branch(t(i, 'a'), t(i, 'b'), 10000)
    if (d.id === 'treble-bleed') branch(t(i, 'a'), t(i, 'b'), 68000)
    if (d.id === 'mono-jack')
      outputs.push({ id: i.id + ':tip', hot: n(t(i, 'tip')), cold: n(t(i, 'sleeve')) })
    if (d.id === 'stereo-jack') {
      outputs.push(
        { id: i.id + ':tip', hot: n(t(i, 'tip')), cold: n(t(i, 'sleeve')) },
        { id: i.id + ':ring', hot: n(t(i, 'ring')), cold: n(t(i, 'sleeve')) },
      )
    }
  }
  return { u, terminals, nets, branches, sources, outputs }
}
const reach = (bs: Branch[], origin: string) => {
  const seen = new Set([origin]),
    q = [origin]
  while (q.length) {
    const x = q.shift()!
    for (const e of bs) {
      const y = e.a === x ? e.b : e.b === x ? e.a : ''
      if (y && !seen.has(y)) {
        seen.add(y)
        q.push(y)
      }
    }
  }
  return seen
}
const solve = (
  n: Network,
  s: Source,
  o: Output,
  load: number,
  alt: boolean,
): { v: number; nets: Set<string> } | null => {
  const relevant = reach(n.branches, o.cold)
  if (o.hot === o.cold || !relevant.has(o.hot) || !relevant.has(s.a) || !relevant.has(s.b))
    return { v: 0, nets: relevant }
  const nodes = [...relevant].filter((x) => x !== o.cold)
  if (nodes.length > MAX_NODES) return null
  const ix = new Map(nodes.map((x, i) => [x, i])),
    m = Array.from({ length: nodes.length }, () => Array(nodes.length + 1).fill(0))
  const stamp = (a: string, b: string, g: number) => {
    const i = ix.get(a),
      j = ix.get(b)
    if (i !== undefined) m[i][i] += g
    if (j !== undefined) m[j][j] += g
    if (i !== undefined && j !== undefined) {
      m[i][j] -= g
      m[j][i] -= g
    }
  }
  for (const e of n.branches)
    if (relevant.has(e.a) && relevant.has(e.b) && e.a !== e.b) stamp(e.a, e.b, alt ? e.alt : e.g)
  stamp(o.hot, o.cold, 1 / load)
  const a = ix.get(s.a),
    b = ix.get(s.b)
  if (a !== undefined) m[a][nodes.length] -= 1 / SOURCE_R
  if (b !== undefined) m[b][nodes.length] += 1 / SOURCE_R
  for (let c = 0; c < nodes.length; c++) {
    let pivot = c
    for (let r = c + 1; r < nodes.length; r++)
      if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) pivot = r
    if (Math.abs(m[pivot][c]) < 1e-13) return null
    ;[m[c], m[pivot]] = [m[pivot], m[c]]
    const d = m[c][c]
    for (let k = c; k <= nodes.length; k++) m[c][k] /= d
    for (let r = 0; r < nodes.length; r++) {
      if (r === c) continue
      const f = m[r][c]
      for (let k = c; k <= nodes.length; k++) m[r][k] -= f * m[c][k]
    }
  }
  const voltage = (x: string) => (x === o.cold ? 0 : (m[ix.get(x)!]?.[nodes.length] ?? 0))
  const carrying = new Set<string>()
  for (const e of n.branches)
    if (relevant.has(e.a) && relevant.has(e.b) && Math.abs(voltage(e.a) - voltage(e.b)) > 1e-9) {
      carrying.add(e.a)
      carrying.add(e.b)
    }
  carrying.add(o.hot)
  carrying.add(o.cold)
  return { v: voltage(o.hot), nets: carrying }
}
const probe = (
  n: Network,
  s: Source,
): { out: Record<string, ProbeAmplitude>; nets: Set<string> } | null => {
  const out: Record<string, ProbeAmplitude> = {},
    nets = new Set<string>()
  for (const o of n.outputs) {
    const high = solve(n, s, o, LOADS.highLoad, false),
      low = solve(n, s, o, LOADS.lowLoad, true)
    if (
      !high ||
      !low ||
      Math.abs(high.v) > EPS !== Math.abs(low.v) > EPS ||
      (Math.abs(high.v) > EPS && Math.abs(low.v) > EPS && Math.sign(high.v) !== Math.sign(low.v))
    )
      return null
    out[o.id] = { highLoad: high.v, lowLoad: low.v }
    for (const x of high.nets) nets.add(x)
  }
  return { out, nets }
}
const active = (out: Record<string, ProbeAmplitude>) =>
  Object.values(out).some((x) => Math.abs(x.highLoad) > EPS || Math.abs(x.lowLoad) > EPS)
const combinations = (doc: WireFactoryDocument) => {
  let rows: { states: Record<string, string>; choice: Choice }[] = [{ states: {}, choice: {} }]
  for (const i of doc.instances.filter((x) => definition(x.definitionId)?.contactModel)) {
    const states = definition(i.definitionId)!.contactModel!.states
    if (rows.length * states.length > MAX_COMBOS) return null
    rows = rows.flatMap((r) =>
      states.map((s) => ({
        states: { ...r.states, [i.id]: switchStateLabel(i, s) },
        choice: { ...r.choice, [i.id]: s.id },
      })),
    )
  }
  return rows.length ? rows : [{ states: { current: 'Current wiring' }, choice: {} }]
}
const mode = (n: Network, info: CoilInfluence[], pickup: string) => {
  const all = n.sources.filter((x) => x.pickup === pickup),
    live = all.filter((x) => info.find((i) => i.pickup === pickup && i.coil === x.coil)?.active)
  if (all.length < 2) return
  if (!live.length) return 'inactive'
  if (live.length === 1) return 'split'
  if (live.length !== 2) return 'complex'
  const [a, b] = live
  if ((a.a === b.a && a.b === b.b) || (a.a === b.b && a.b === b.a)) return 'parallel'
  const shared = [a.a, a.b].find((x) => x === b.a || x === b.b)
  if (
    shared &&
    !n.outputs.some((o) => o.hot === shared || o.cold === shared) &&
    n.branches.filter((e) => e.a !== e.b && (e.a === shared || e.b === shared)).length === 2
  )
    return 'series'
  return 'complex'
}
const syntax = (doc: WireFactoryDocument, d: Diagnostic[]) => {
  const ids = new Set<string>(),
    terms = new Set<string>(),
    wires = new Set<string>(),
    pairs = new Set<string>()
  for (const i of doc.instances) {
    if (ids.has(i.id)) {
      add(d, 'DUPLICATE_INSTANCE', 'Duplicate component id: ' + i.id)
      d.at(-1)!.componentIds = [i.id]
    }
    ids.add(i.id)
    const x = definition(i.definitionId)
    if (
      !x ||
      i.definitionVersion !== 1 ||
      i.pinoutVersion !== 1 ||
      i.pinoutId !== i.definitionId + '-generic'
    ) {
      add(d, 'UNKNOWN_PINOUT', 'Unknown component definition or pinout: ' + i.definitionId)
      d.at(-1)!.componentIds = [i.id]
    }
    for (const t of x?.terminals ?? []) terms.add(terminalKey(i.id, t.id))
    if (
      x?.contactModel &&
      i.controlState &&
      !x.contactModel.states.some((s) => s.id === i.controlState)
    ) {
      add(d, 'INVALID_SWITCH_STATE', 'Invalid switch state: ' + i.id)
      d.at(-1)!.componentIds = [i.id]
    }
  }
  for (const w of doc.wires) {
    if (wires.has(w.id)) {
      add(d, 'DUPLICATE_WIRE', 'Duplicate wire id: ' + w.id)
      d.at(-1)!.wireIds = [w.id]
    }
    wires.add(w.id)
    if (!terms.has(w.from) || !terms.has(w.to) || w.from === w.to) {
      add(d, 'INVALID_ENDPOINT', 'Wire endpoint is missing or invalid.', [w.from, w.to])
      d.at(-1)!.wireIds = [w.id]
    }
    const p = pair(w.from, w.to)
    if (pairs.has(p)) {
      add(d, 'DUPLICATE_CONNECTION', 'The same connection exists twice.', [w.from, w.to])
      d.at(-1)!.wireIds = [w.id]
    }
    pairs.add(p)
  }
}
export const electricalFingerprint = (doc: WireFactoryDocument, controls: ControlState) =>
  JSON.stringify({
    instances: doc.instances
      .map((i) => ({
        id: i.id,
        definitionId: i.definitionId,
        definitionVersion: i.definitionVersion,
        pinoutId: i.pinoutId,
        pinoutVersion: i.pinoutVersion,
        values: Object.fromEntries(Object.entries(i.values).sort(([a], [b]) => a.localeCompare(b))),
        controlState: i.controlState ?? null,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    wires: doc.wires
      .map((w) => ({ id: w.id, ends: [w.from, w.to].sort() }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    controls,
    expectation: doc.expectation,
  })
export function resolve(doc: WireFactoryDocument, supplied?: ControlState): ResolvedCircuit {
  const stored = doc.instances.find((i) => i.values.control === 'selector')?.controlState
  const c: ControlState = {
      ...DEFAULT_CONTROLS,
      ...(stored === 'neck' || stored === 'middle' || stored === 'bridge'
        ? { selector: stored }
        : {}),
      ...supplied,
    },
    d: Diagnostic[] = []
  syntax(doc, d)
  let unsupported = false
  for (const i of doc.instances) {
    const def = definition(i.definitionId)
    if (
      def &&
      !def.electricalModel &&
      doc.wires.some((w) => w.from.startsWith(i.id + ':') || w.to.startsWith(i.id + ':'))
    ) {
      unsupported = true
      add(d, 'UNMODELED_COMPONENT', 'No electrical model for ' + i.label, [], 'warning')
      d.at(-1)!.componentIds = [i.id]
    }
  }
  const combos = combinations(doc),
    current = network(doc, c)
  if (!combos)
    add(
      d,
      'ANALYSIS_LIMIT',
      'More than 512 switch combinations; structural analysis is incomplete.',
      [],
      'warning',
    )
  if (!current.outputs.length) add(d, 'NO_OUTPUT', 'No mono or stereo output port is present.')
  if (!current.sources.length) add(d, 'NO_SOURCE', 'No pickup source is present.')
  const blocked =
    unsupported ||
    doc.instances.length > 80 ||
    doc.wires.length > 180 ||
    !combos ||
    combos.length *
      Math.max(1, current.sources.length) *
      Math.max(1, current.outputs.length) *
      2 *
      Math.pow(Math.max(1, current.branches.length + current.outputs.length), 3) >
      MAX_WORK
  if (combos && blocked)
    add(
      d,
      'ANALYSIS_WORK_LIMIT',
      'The finite-network analysis exceeds the browser computation budget and is incomplete.',
      [],
      'warning',
    )
  const functionTable: FunctionRow[] = blocked
    ? []
    : combos!.map(({ states, choice }) => {
        const n = network(doc, DEFAULT_CONTROLS, choice),
          byOutput = new Map(n.outputs.map((o) => [o.id, new Set<string>()]))
        const stateInfluence: CoilInfluence[] = []
        let unknown = false
        for (const s of n.sources) {
          const r = probe(n, s)
          if (!r) {
            unknown = true
            continue
          }
          stateInfluence.push({
            pickup: s.pickup,
            coil: s.coil,
            outputs: r.out,
            active: active(r.out),
          })
          for (const [id, amp] of Object.entries(r.out))
            if (active({ [id]: amp })) byOutput.get(id)?.add(s.pickup)
        }
        const outputs = Object.fromEntries(
            n.outputs.map((o) => {
              const sources = [...(byOutput.get(o.id) ?? [])]
              return [
                o.id,
                {
                  sources,
                  muted: o.hot === o.cold,
                  unknown,
                  state: unknown
                    ? 'unknown'
                    : o.hot === o.cold
                      ? 'muted'
                      : sources.length
                        ? 'active'
                        : 'open',
                } satisfies OutputObservation,
              ]
            }),
          ),
          sources = [...new Set([...byOutput.values()].flatMap((x) => [...x]))]
        return {
          current: Object.entries(choice).every(
            ([id, value]) =>
              switchState(
                doc.instances.find((i) => i.id === id)!,
                c,
                {},
              ) === value,
          ),
          key: Object.entries(choice)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([a, b]) => a + '=' + b)
            .join(','),
          selector:
            Object.entries(states)
              .map(
                ([id, label]) =>
                  (doc.instances.find((i) => i.id === id)?.label ?? id) + ': ' + label,
              )
              .join(' / ') || 'Current wiring',
          states,
          sources,
          muted: !sources.length,
          unknown,
          outputs,
          coilModes: Object.fromEntries(
            [...new Set(n.sources.map((s) => s.pickup))].map((p) => [
              p,
              mode(n, stateInfluence, p) ?? 'single source',
            ]),
          ),
          neck: sources.includes('neck'),
          bridge: sources.includes('bridge'),
        }
      })
  const coilInfluence: CoilInfluence[] = [],
    nets = new Set<string>()
  if (!blocked)
    for (const s of current.sources) {
      const r = probe(current, s),
        out = r?.out ?? {},
        on = active(out)
      coilInfluence.push({ pickup: s.pickup, coil: s.coil, outputs: out, active: on })
      if (on) for (const x of r?.nets ?? []) nets.add(x)
    }
  const unknown =
    blocked ||
    functionTable.some((x) => x.unknown) ||
    (!blocked &&
      current.sources.length > 0 &&
      coilInfluence.some((x) => !Object.keys(x.outputs).length))
  if (unknown)
    add(
      d,
      'ANALYSIS_UNKNOWN',
      'A relevant finite network is singular, inconsistent or exceeds the analysis limit.',
      [],
      'warning',
    )
  const viable = functionTable.some((x) => !x.unknown && !x.muted)
  if (!unknown && !viable)
    add(d, 'NO_VIABLE_OUTPUT', 'No pickup contributes to any output in an analyzed switch state.')
  const structuralStatus: StructuralStatus = d.some((x) => x.severity === 'error')
    ? 'invalid'
    : unknown
      ? 'unknown'
      : viable
        ? 'valid'
        : 'invalid'
  const match = identifyTopology(doc)
  const actualWireNets = new UF()
  for (const w of doc.wires) actualWireNets.union(w.from, w.to)
  const expectedWireNets = new UF()
  if (match)
    for (const [a, b] of match.topology.connections)
      expectedWireNets.union(slotTerminal(match, a), slotTerminal(match, b))
  const terminals = [...current.terminals]
  const expectationConnectionsMatch =
    !!match &&
    terminals.every((a) =>
      terminals.every(
        (b) =>
          (actualWireNets.find(a) === actualWireNets.find(b)) ===
          (expectedWireNets.find(a) === expectedWireNets.find(b)),
      ),
    )
  const expectationStatus: ExpectationStatus =
    doc.expectation === null
      ? 'none'
      : !topologies.some((x) => x.id === doc.expectation!.id)
        ? 'unavailable'
        : match?.topology.id === doc.expectation.id && expectationConnectionsMatch
          ? 'matched'
          : 'deviated'
  if (expectationStatus === 'deviated')
    add(
      d,
      'EXPECTATION_DEVIATED',
      'The saved topology expectation differs; structural validity is evaluated separately.',
      [],
      'warning',
    )
  if (!unknown)
    for (const source of new Set(current.sources.map((s) => s.pickup)))
      if (!functionTable.some((row) => row.sources.includes(source))) {
        add(
          d,
          'INACTIVE_PICKUP',
          'No output contribution in any checked switch state: ' +
            (doc.instances.find((i) => i.id === source)?.label ?? source),
          (
            definition(doc.instances.find((i) => i.id === source)?.definitionId ?? '')?.terminals ??
            []
          )
            .filter((term) => term.role !== 'shield')
            .map((term) => terminalKey(source, term.id)),
          'warning',
        )
        d.at(-1)!.componentIds = [source]
      }
  for (const item of doc.instances)
    for (const term of definition(item.definitionId)?.terminals ?? [])
      if (term.role === 'shield') {
        const pin = terminalKey(item.id, term.id)
        if (
          doc.wires.some((w) => w.from === pin || w.to === pin) &&
          !current.outputs.some((o) => current.u.find(pin) === o.cold)
        )
          add(
            d,
            'SHIELD_NOT_GROUNDED',
            'Connected shield is not on an output return: ' + item.label,
            [pin],
            'warning',
          )
      }
  const outputObservations = Object.fromEntries(
    current.outputs.map((o) => {
      const sources = [
        ...new Set(
          coilInfluence
            .filter((x) => active({ port: x.outputs[o.id] ?? { highLoad: 0, lowLoad: 0 } }))
            .map((x) => x.pickup),
        ),
      ]
      return [
        o.id,
        {
          sources,
          muted: o.hot === o.cold,
          unknown,
          state: unknown
            ? 'unknown'
            : o.hot === o.cold
              ? 'muted'
              : sources.length
                ? 'active'
                : 'open',
        } satisfies OutputObservation,
      ]
    }),
  )
  const activeTerminals = [...current.nets].filter(([, net]) => nets.has(net)).map(([t]) => t),
    activeWireIds = doc.wires
      .filter((w) => nets.has(current.u.find(w.from)) && nets.has(current.u.find(w.to)))
      .map((w) => w.id),
    paths = [...new Set(current.sources.map((s) => s.pickup))].map((pickup) => {
      const coils = coilInfluence.filter((x) => x.pickup === pickup),
        on = coils.some((x) => x.active)
      return {
        pickup,
        selector: 'current',
        selected: on,
        active: on,
        muted: !on,
        coilMode: mode(current, coilInfluence, pickup),
        coilCount: coils.filter((x) => x.active).length,
        terminals: activeTerminals,
        wireIds: activeWireIds,
      }
    })
  return {
    outputObservations,
    diagnostics: presentDiagnostics(doc, d),
    paths,
    functionTable,
    coilInfluence,
    activeTerminals,
    activeWireIds,
    buildReady: structuralStatus === 'valid',
    incomplete: structuralStatus === 'unknown',
    outputMuted:
      Object.keys(outputObservations).length > 0 &&
      Object.values(outputObservations).every((o) => o.state === 'muted'),
    verificationStatus:
      structuralStatus === 'valid'
        ? 'verified'
        : structuralStatus === 'unknown'
          ? 'unknown'
          : 'invalid',
    structuralStatus,
    expectationStatus,
    topology: match ? { id: match.topology.id, name: match.topology.name } : null,
    outputs: current.outputs.map((o) => o.id),
  }
}
