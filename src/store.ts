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
import { starterDocument } from './circuit/template'

type State = {
  doc: WireFactoryDocument
  past: WireFactoryDocument[]
  future: WireFactoryDocument[]
  selected: string | null
  selectedWire: string | null
  pendingTerminal: string | null
  controls: ControlState
  commit: (next: WireFactoryDocument) => void
  move: (id: string, x: number, y: number) => void
  add: (definitionId: string) => void
  remove: (id: string) => void
  wire: (from: string, to: string) => void
  removeWire: (id: string) => void
  open: (text: string) => void
  reset: () => void
  undo: () => void
  redo: () => void
  setSelected: (id: string | null) => void
  setSelectedWire: (id: string | null) => void
  setPendingTerminal: (key: string | null) => void
  setControl: <Key extends keyof ControlState>(key: Key, value: ControlState[Key]) => void
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
  const instanceIds = [splitTerminalKey(from)[0], splitTerminalKey(to)[0]]
  if (instanceIds.some((id) => id === 'tone' || id === 'cap')) return 'tone'
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
  commit: (next) =>
    set((state) => ({
      doc: clone(next),
      past: [...state.past, clone(state.doc)].slice(-80),
      future: [],
    })),
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
    doc.expectation = null
    get().commit(doc)
    set({ selected: null, selectedWire: null })
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
      controls: { ...DEFAULT_CONTROLS },
    }))
  },
  reset: () => {
    get().commit(starterDocument())
    set({
      selected: null,
      selectedWire: null,
      pendingTerminal: null,
      controls: { ...DEFAULT_CONTROLS },
    })
  },
  undo: () =>
    set((state) => {
      const previous = state.past.at(-1)
      return previous
        ? {
            doc: clone(previous),
            past: state.past.slice(0, -1),
            future: [clone(state.doc), ...state.future].slice(0, 80),
            selected: null,
            selectedWire: null,
          }
        : {}
    }),
  redo: () =>
    set((state) => {
      const next = state.future[0]
      return next
        ? {
            doc: clone(next),
            past: [...state.past, clone(state.doc)].slice(-80),
            future: state.future.slice(1),
            selected: null,
            selectedWire: null,
          }
        : {}
    }),
  setSelected: (selected) => set({ selected, selectedWire: null }),
  setSelectedWire: (selectedWire) => set({ selectedWire, selected: null }),
  setPendingTerminal: (pendingTerminal) => set({ pendingTerminal }),
  setControl: (key, value) => set((state) => ({ controls: { ...state.controls, [key]: value } })),
}))
