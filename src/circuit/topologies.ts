import { terminalKey, type Instance, type WireFactoryDocument } from './model'

export type TopologyId =
  'starter-2hb-2v-1t' | '2hb-1v-1t' | '2hb-1v-1t-split-push-pull' | '2hb-1v-1t-split-push-push'
export interface Topology {
  id: TopologyId
  name: string
  slots: Record<string, { definitionId: string; values?: Record<string, string> }>
  connections: [string, string][]
  grounds: string[]
}

const sharedSlots = {
  neck: { definitionId: 'hb-2c-braid', values: { position: 'neck' } },
  bridge: { definitionId: 'hb-2c-braid', values: { position: 'bridge' } },
  selector: { definitionId: 'three-way-toggle', values: { control: 'selector' } },
  tone: { definitionId: 'pot-500k-audio', values: { control: 'tone' } },
  cap: { definitionId: 'capacitor' },
  jack: { definitionId: 'mono-jack' },
  ground: { definitionId: 'junction' },
} as const

const sharedConnections: [string, string][] = [
  ['selector.common', 'tone.in'],
  ['tone.out', 'cap.a'],
  ['cap.b', 'ground.node'],
  ['neck.ground', 'ground.node'],
  ['neck.shield', 'ground.node'],
  ['bridge.ground', 'ground.node'],
  ['bridge.shield', 'ground.node'],
  ['tone.ground', 'ground.node'],
  ['ground.node', 'jack.sleeve'],
]
const sharedGrounds = [
  'neck.ground',
  'neck.shield',
  'bridge.ground',
  'bridge.shield',
  'tone.ground',
]

export const topologies: Topology[] = [
  {
    id: 'starter-2hb-2v-1t',
    name: '2HB / 2V / 1T',
    slots: {
      ...sharedSlots,
      neckVolume: { definitionId: 'pot-500k-audio', values: { control: 'neck-volume' } },
      bridgeVolume: { definitionId: 'pot-500k-audio', values: { control: 'bridge-volume' } },
    },
    connections: [
      ...sharedConnections,
      ['selector.common', 'jack.tip'],
      ['neck.hot', 'neckVolume.in'],
      ['neckVolume.out', 'selector.neck'],
      ['bridge.hot', 'bridgeVolume.in'],
      ['bridgeVolume.out', 'selector.bridge'],
      ['neckVolume.ground', 'ground.node'],
      ['bridgeVolume.ground', 'ground.node'],
    ],
    grounds: [...sharedGrounds, 'neckVolume.ground', 'bridgeVolume.ground'],
  },
  {
    id: '2hb-1v-1t',
    name: '2HB / 1V / 1T',
    slots: {
      ...sharedSlots,
      masterVolume: { definitionId: 'pot-500k-audio', values: { control: 'master-volume' } },
    },
    connections: [
      ...sharedConnections,
      ['neck.hot', 'selector.neck'],
      ['bridge.hot', 'selector.bridge'],
      ['selector.common', 'masterVolume.in'],
      ['masterVolume.out', 'jack.tip'],
      ['masterVolume.ground', 'ground.node'],
    ],
    grounds: [...sharedGrounds, 'masterVolume.ground'],
  },
  ...(['push-pull-dpdt', 'push-push-dpdt'] as const).map(
    (definitionId) =>
      ({
        id: (definitionId === 'push-pull-dpdt'
          ? '2hb-1v-1t-split-push-pull'
          : '2hb-1v-1t-split-push-push') as TopologyId,
        name: '2HB / 1V / 1T / dual split',
        slots: {
          neck: { definitionId: 'hb-4c-shield', values: { position: 'neck' } },
          bridge: { definitionId: 'hb-4c-shield', values: { position: 'bridge' } },
          selector: { definitionId: 'three-way-toggle', values: { control: 'selector' } },
          masterVolume: { definitionId: 'pot-500k-audio', values: { control: 'master-volume' } },
          tone: { definitionId, values: { control: 'tone' } },
          cap: { definitionId: 'capacitor' },
          jack: { definitionId: 'mono-jack' },
          ground: { definitionId: 'junction' },
        },
        connections: [
          ['neck.north-start', 'selector.neck'],
          ['bridge.north-start', 'selector.bridge'],
          ['selector.common', 'masterVolume.in'],
          ['masterVolume.out', 'jack.tip'],
          ['selector.common', 'tone.in'],
          ['tone.out', 'cap.a'],
          ['cap.b', 'ground.node'],
          ['neck.south-start', 'ground.node'],
          ['bridge.south-start', 'ground.node'],
          ['neck.shield', 'ground.node'],
          ['bridge.shield', 'ground.node'],
          ['masterVolume.ground', 'ground.node'],
          ['tone.ground', 'ground.node'],
          ['ground.node', 'jack.sleeve'],
          ['neck.north-finish', 'neck.south-finish'],
          ['bridge.north-finish', 'bridge.south-finish'],
          ['neck.north-finish', 'tone.a2'],
          ['bridge.north-finish', 'tone.b2'],
          ['tone.a3', 'ground.node'],
          ['tone.b3', 'ground.node'],
        ],
        grounds: [
          'neck.south-start',
          'bridge.south-start',
          'neck.shield',
          'bridge.shield',
          'masterVolume.ground',
          'tone.ground',
        ],
      }) as Topology,
  ),
]

const fits = (item: Instance, slot: Topology['slots'][string]) =>
  item.definitionId === slot.definitionId &&
  Object.entries(slot.values ?? {}).every(([key, value]) => item.values[key] === value)

export interface TopologyMatch {
  topology: Topology
  instances: Record<string, Instance>
}
export function identifyTopology(doc: WireFactoryDocument): TopologyMatch | null {
  for (const topology of topologies) {
    if (doc.instances.length !== Object.keys(topology.slots).length) continue
    const instances: Record<string, Instance> = {}
    for (const [slot, spec] of Object.entries(topology.slots)) {
      const candidates = doc.instances.filter((item) => fits(item, spec))
      if (candidates.length !== 1) break
      instances[slot] = candidates[0]
    }
    if (
      Object.keys(instances).length === Object.keys(topology.slots).length &&
      new Set(Object.values(instances).map((item) => item.id)).size === doc.instances.length
    )
      return { topology, instances }
  }
  return null
}

export const slotTerminal = (match: TopologyMatch, path: string) => {
  const [slot, terminal] = path.split('.')
  return terminalKey(match.instances[slot].id, terminal)
}
