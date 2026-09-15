import type { Instance } from './model'

// Saved user-facing names do not certify the physical switch wiring.
export const switchStateLabel = (instance: Instance, state: { id: string; label: string }) =>
  instance.definitionId === 'dpdt-on-on' && instance.values.switchSemantics === 'series-parallel'
    ? ({ 'on-a': 'Parallel (A)', 'on-b': 'Series (B)' }[state.id] ?? state.label)
    : state.label
