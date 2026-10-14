import { create } from 'zustand'
import { catalog, definition } from './circuit/catalog'
import { parseProject } from './circuit/file'
import {
  DEFAULT_CONTROLS,
  splitTerminalKey,
  type ControlState,
  type Instance,
  type Wire,
  type WireFactoryDocument,
} from './circuit/model'
import {
  fiveWaySingleCoilDocument,
  masterVolumeDocument,
  seriesParallelDocument,
  splitCoilMonoDocument,
  splitCoilPushPullDocument,
  splitCoilStereoDocument,
  splitDocument,
  starterDocument,
} from './circuit/template'
import { electricalFingerprint, resolve, type ResolvedCircuit } from './circuit/resolver'

type State = {
  doc: WireFactoryDocument
  past: WireFactoryDocument[]
  future: WireFactoryDocument[]
  selected: string | null
  selectedWire: string | null
  pendingTerminal: string | null
  controls: ControlState
  checks: Record<string, ResolvedCircuit>
  check: () => void
  commit: (next: WireFactoryDocument) => void
  move: (id: string, x: number, y: number) => void
  add: (definitionId: string) => void
  remove: (id: string) => void
  wire: (from: string, to: string) => void
  removeWire: (id: string) => void
  open: (text: string) => void
  reset: () => void
  newMasterVolume: () => void
  newSplit: (kind: 'push-pull-dpdt' | 'push-push-dpdt') => void
  newFiveWay: () => void
  newSeriesParallel: () => void
  newSplitCoil: (kind: 'stereo' | 'mono' | 'pushpull') => void
  selectedDiagnostic: number | null
  setSelectedDiagnostic: (index: number | null) => void
  undo: () => void
  redo: () => void
  setSelected: (id: string | null) => void
  setSelectedWire: (id: string | null) => void
  setPendingTerminal: (key: string | null) => void
  setComponentState: (id: string, value: string) => void
  setControl: <Key extends keyof ControlState>(key: Key, value: ControlState[Key]) => void
}

const selectorForDoc = (doc: WireFactoryDocument): ControlState['selector'] => {
  const value = doc.instances.find((item) => item.values.control === 'selector')?.controlState
  return value === 'neck' || value === 'bridge' ? value : 'middle'
}
const clone = (doc: WireFactoryDocument) => structuredClone(doc)
const randomId = () => crypto.randomUUID().slice(0, 8)

const roleForTerminal = (doc: WireFactoryDocument, key: string) => {
  const [instanceId, terminalId] = splitTerminalKey(key)
  const instance = doc.instances.find((item) => item.id === instanceId)
  return definition(instance?.definitionId ?? '')?.terminals.find(
    (terminal) => terminal.id === terminalId,
  )?.role
}

const inferWireRole = (doc: WireFactoryDocument, from: string, to: string): Wire['role'] => {
  const roles = [roleForTerminal(doc, from), roleForTerminal(doc, to)]
  if (roles.includes('shield')) return 'shield'
  if (roles.some((role) => role === 'ground' || role === 'sleeve')) return 'ground'
  const terminals = [from, to].map((key) => {
    const [instanceId] = splitTerminalKey(key)
    return doc.instances.find((item) => item.id === instanceId)?.values.control
  })
  if (terminals.includes('tone')) return 'tone'
  return 'signal'
}

const wireColor = (role: Wire['role']) =>
  ({ signal: '#f0b35a', ground: '#9aa8b7', shield: '#7dd3fc', tone: '#60a5fa' })[role]

export const useCircuitStore = create<State>((set, get) => ({
  doc: starterDocument(),
  past: [],
  future: [],
  selected: null,
  selectedWire: null,
  pendingTerminal: null,
  controls: { ...DEFAULT_CONTROLS },
  checks: {},
  selectedDiagnostic: null,
  check: () => {
    const state = get()
    const fingerprint = electricalFingerprint(state.doc, state.controls)
    set({ checks: {}, selectedDiagnostic: null })
    const result = resolve(state.doc, state.controls)
    set({ checks: { [fingerprint]: result } })
  },
  commit: (next) =>
    set((state) => {
      const controls = { ...state.controls, selector: selectorForDoc(next) }
      const changed =
        electricalFingerprint(state.doc, state.controls) !== electricalFingerprint(next, controls)
      return {
        doc: clone(next),
        controls,
        past: [...state.past, clone(state.doc)].slice(-80),
        future: [],
        ...(changed ? { selectedDiagnostic: null } : {}),
      }
    }),
  move: (id, x, y) => {
    const doc = clone(get().doc)
    const item = doc.instances.find((entry) => entry.id === id)
    if (!item || (item.x === Math.round(x) && item.y === Math.round(y))) return
    item.x = Math.max(0, Math.round(x))
    item.y = Math.max(0, Math.round(y))
    get().commit(doc)
  },
  add: (definitionId) => {
    const found = catalog.find((entry) => entry.id === definitionId)
    if (!found) return
    const doc = clone(get().doc)
    const id = `${definitionId}-${randomId()}`
    const item: Instance = {
      id,
      definitionId,
      definitionVersion: 1,
      pinoutId: `${definitionId}-generic`,
      pinoutVersion: 1,
      values: {},
      x: 220 + (doc.instances.length % 5) * 42,
      y: 120 + (doc.instances.length % 6) * 54,
      rotation: 0,
      label: found.name,
    }
    doc.instances.push(item)
    doc.expectation = null
    get().commit(doc)
  },
  remove: (id) => {
    const doc = clone(get().doc)
    doc.instances = doc.instances.filter((item) => item.id !== id)
    doc.wires = doc.wires.filter(
      (wire) => !wire.from.startsWith(`${id}:`) && !wire.to.startsWith(`${id}:`),
    )
    get().commit(doc)
    set({ selected: null, selectedWire: null, pendingTerminal: null })
  },
  wire: (from, to) => {
    if (from === to) return
    const doc = clone(get().doc)
    if (
      doc.wires.some(
        (wire) => (wire.from === from && wire.to === to) || (wire.from === to && wire.to === from),
      )
    ) {
      return
    }
    const role = inferWireRole(doc, from, to)
    doc.wires.push({
      id: `wire-${randomId()}`,
      from,
      to,
      role,
      color: wireColor(role),
      label: '',
      waypoints: [],
    })
    get().commit(doc)
  },
  removeWire: (id) => {
    const doc = clone(get().doc)
    doc.wires = doc.wires.filter((wire) => wire.id !== id)
    get().commit(doc)
    set({ selectedWire: null })
  },
  open: (text) => {
    const parsed = parseProject(text)
    set((state) => ({
      doc: parsed,
      past: [...state.past, clone(state.doc)].slice(-80),
      future: [],
      selected: null,
      selectedWire: null,
      pendingTerminal: null,
      controls: { ...DEFAULT_CONTROLS, selector: selectorForDoc(parsed) },
      checks: {},
      selectedDiagnostic: null,
    }))
  },
  reset: () => {
    get().commit(starterDocument())
    set({
      selected: null,
      selectedWire: null,
      pendingTerminal: null,
      controls: { ...DEFAULT_CONTROLS },
      checks: {},
      selectedDiagnostic: null,
    })
  },
  newMasterVolume: () => {
    get().commit(masterVolumeDocument())
    set({
      selected: null,
      selectedWire: null,
      pendingTerminal: null,
      controls: { ...DEFAULT_CONTROLS },
      checks: {},
      selectedDiagnostic: null,
    })
  },
  newFiveWay: () => {
    get().commit(fiveWaySingleCoilDocument())
    set({
      selected: null,
      selectedWire: null,
      pendingTerminal: null,
      controls: { ...DEFAULT_CONTROLS },
      checks: {},
      selectedDiagnostic: null,
    })
  },
  newSeriesParallel: () => {
    get().commit(seriesParallelDocument())
    set({
      selected: null,
      selectedWire: null,
      pendingTerminal: null,
      controls: { ...DEFAULT_CONTROLS },
      checks: {},
      selectedDiagnostic: null,
    })
  },
  newSplitCoil: (kind) => {
    get().commit(
      kind === 'stereo'
        ? splitCoilStereoDocument()
        : kind === 'mono'
          ? splitCoilMonoDocument()
          : splitCoilPushPullDocument(),
    )
    set({
      selected: null,
      selectedWire: null,
      pendingTerminal: null,
      controls: { ...DEFAULT_CONTROLS },
      checks: {},
      selectedDiagnostic: null,
    })
  },
  newSplit: (kind) => {
    get().commit(splitDocument(kind))
    set({
      selected: null,
      selectedWire: null,
      pendingTerminal: null,
      controls: { ...DEFAULT_CONTROLS },
      checks: {},
      selectedDiagnostic: null,
    })
  },
  undo: () =>
    set((state) => {
      const previous = state.past.at(-1)
      return previous
        ? {
            doc: clone(previous),
            selectedDiagnostic:
              electricalFingerprint(state.doc, state.controls) ===
              electricalFingerprint(previous, {
                ...state.controls,
                selector: selectorForDoc(previous),
              })
                ? state.selectedDiagnostic
                : null,
            controls: { ...state.controls, selector: selectorForDoc(previous) },
            past: state.past.slice(0, -1),
            future: [clone(state.doc), ...state.future].slice(0, 80),
            selected: null,
            selectedWire: null,
            pendingTerminal: null,
          }
        : {}
    }),
  redo: () =>
    set((state) => {
      const next = state.future[0]
      return next
        ? {
            doc: clone(next),
            selectedDiagnostic:
              electricalFingerprint(state.doc, state.controls) ===
              electricalFingerprint(next, { ...state.controls, selector: selectorForDoc(next) })
                ? state.selectedDiagnostic
                : null,
            controls: { ...state.controls, selector: selectorForDoc(next) },
            past: [...state.past, clone(state.doc)].slice(-80),
            future: state.future.slice(1),
            selected: null,
            selectedWire: null,
            pendingTerminal: null,
          }
        : {}
    }),
  setSelectedDiagnostic: (selectedDiagnostic) =>
    set((state) => {
      const result = state.checks[electricalFingerprint(state.doc, state.controls)]
      return {
        selectedDiagnostic:
          selectedDiagnostic !== null &&
          Number.isInteger(selectedDiagnostic) &&
          result?.diagnostics[selectedDiagnostic]
            ? selectedDiagnostic
            : null,
      }
    }),
  setSelected: (selected) => set({ selected, selectedWire: null }),
  setSelectedWire: (selectedWire) => set({ selectedWire, selected: null }),
  setPendingTerminal: (pendingTerminal) => set({ pendingTerminal }),
  setComponentState: (id, value) => {
    const doc = clone(get().doc)
    const item = doc.instances.find((entry) => entry.id === id)
    if (
      !item ||
      item.controlState === value ||
      !definition(item.definitionId)?.contactModel?.states.some((state) => state.id === value)
    )
      return
    item.controlState = value
    get().commit(doc)
  },
  setControl: (key, value) => {
    if (key === 'selector') {
      const item = get().doc.instances.find((item) => item.values.control === 'selector')
      if (item) {
        get().setComponentState(item.id, value)
        return
      }
    }
    set((state) => ({ controls: { ...state.controls, [key]: value }, selectedDiagnostic: null }))
  },
}))
