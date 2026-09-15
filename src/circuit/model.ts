export const FORMAT = 'wirefactory-project' as const
export const VERSION = 1 as const

export type TerminalRole =
  'hot' | 'ground' | 'shield' | 'signal' | 'tip' | 'sleeve' | 'contact' | 'component'
export type WireRole = 'signal' | 'ground' | 'tone' | 'shield'
export type SelectorState = 'neck' | 'middle' | 'bridge'
export type PotState = 'zero' | 'mid' | 'full'
export type RuntimeBehavior =
  | 'pickup'
  | 'potentiometer'
  | 'selector-3way'
  | 'capacitor'
  | 'mono-jack'
  | 'junction'
  | 'unsupported'
export type VerificationStatus = 'verified' | 'invalid' | 'unknown' | 'unsupported'

export type ContactState = { id: string; label: string; pairs: [string, string][] }
export interface ContactModel {
  defaultState: string
  states: ContactState[]
}

export interface Definition {
  id: string
  version: 1
  name: string
  category: string
  summary: string
  example: string
  terminals: { id: string; role: TerminalRole; label: string }[]
  source: string
  sourceUrl: string
  limitation: string
  starterVerified: boolean
  /** Catalog-only runtime model; never serialized into a project. */
  electricalModel?: 'pickup' | 'potentiometer' | 'passive' | 'contacts' | 'output' | 'ground'
  behavior: RuntimeBehavior
  /** Logical generic contacts only; never a claim about physical lug order. */
  coils?: { id: string; start: string; finish: string }[]
  contactModel?: ContactModel
}

export interface Instance {
  id: string
  definitionId: string
  definitionVersion: 1
  pinoutId: string
  pinoutVersion: 1
  values: Record<string, string>
  x: number
  y: number
  rotation: number
  label: string
  controlState?: string
}

export interface Wire {
  id: string
  from: string
  to: string
  role: WireRole
  color: string
  label: string
  waypoints: { x: number; y: number }[]
}

export interface Junction {
  id: string
  x: number
  y: number
}

export interface WireFactoryDocument {
  format: typeof FORMAT
  version: typeof VERSION
  title: string
  instances: Instance[]
  wires: Wire[]
  junctions: Junction[]
  expectation: { id: string; version: 1 } | null
}

export interface ControlState {
  selector: SelectorState
  neckVolume: PotState
  bridgeVolume: PotState
  tone: PotState
  masterVolume: PotState
}

export const DEFAULT_CONTROLS: ControlState = {
  selector: 'middle',
  neckVolume: 'full',
  bridgeVolume: 'full',
  tone: 'full',
  masterVolume: 'full',
}

export const terminalKey = (instanceId: string, terminalId: string) => `${instanceId}:${terminalId}`

export const splitTerminalKey = (key: string): [string, string] => {
  const separator = key.lastIndexOf(':')
  return separator < 1 ? [key, ''] : [key.slice(0, separator), key.slice(separator + 1)]
}
