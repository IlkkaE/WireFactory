import type { Instance, Wire, WireFactoryDocument } from './model'
import { FORMAT, VERSION, terminalKey } from './model'

const component = (
  id: string,
  definitionId: string,
  label: string,
  x: number,
  y: number,
  values: Record<string, string> = {},
): Instance => ({
  id,
  definitionId,
  definitionVersion: 1,
  pinoutId: `${definitionId}-generic`,
  pinoutVersion: 1,
  label,
  x,
  y,
  rotation: 0,
  values,
})

const COLORS: Record<Wire['role'], string> = {
  signal: '#f0b35a',
  ground: '#9aa8b7',
  shield: '#7dd3fc',
  tone: '#60a5fa',
}

const wire = (id: string, from: string, to: string, role: Wire['role']): Wire => ({
  id,
  from,
  to,
  role,
  color: COLORS[role],
  label: '',
  waypoints: [],
})

export function starterDocument(): WireFactoryDocument {
  const t = terminalKey
  return {
    format: FORMAT,
    version: VERSION,
    title: '2HB / 2V / 1T starter',
    expectation: { id: 'starter-2hb-2v-1t', version: 1 },
    junctions: [],
    instances: [
      component('neck', 'hb-2c-braid', 'Neck humbucker', 35, 55, { position: 'neck' }),
      component('bridge', 'hb-2c-braid', 'Bridge humbucker', 35, 275, { position: 'bridge' }),
      component('neck-volume', 'pot-500k-audio', 'Neck volume', 255, 55, {
        resistance: '500k',
        taper: 'audio',
        control: 'neck-volume',
      }),
      component('bridge-volume', 'pot-500k-audio', 'Bridge volume', 255, 275, {
        resistance: '500k',
        taper: 'audio',
        control: 'bridge-volume',
      }),
      component('selector', 'three-way-toggle', '3-way selector', 475, 165, {
        control: 'selector',
      }),
      component('tone', 'pot-500k-audio', 'Master tone', 700, 275, {
        resistance: '500k',
        taper: 'audio',
        control: 'tone',
      }),
      component('cap', 'capacitor', '22 nF tone capacitor', 700, 430, {
        capacitance: '22nF',
      }),
      component('jack', 'mono-jack', 'Mono output jack', 700, 55),
      component('ground', 'junction', 'Common ground', 475, 555),
    ],
    wires: [
      wire('w01', t('neck', 'hot'), t('neck-volume', 'in'), 'signal'),
      wire('w02', t('neck-volume', 'out'), t('selector', 'neck'), 'signal'),
      wire('w03', t('bridge', 'hot'), t('bridge-volume', 'in'), 'signal'),
      wire('w04', t('bridge-volume', 'out'), t('selector', 'bridge'), 'signal'),
      wire('w05', t('selector', 'common'), t('jack', 'tip'), 'signal'),
      wire('w06', t('selector', 'common'), t('tone', 'in'), 'tone'),
      wire('w07', t('tone', 'out'), t('cap', 'a'), 'tone'),
      wire('w08', t('cap', 'b'), t('ground', 'node'), 'ground'),
      wire('w09', t('neck', 'ground'), t('ground', 'node'), 'ground'),
      wire('w10', t('neck', 'shield'), t('ground', 'node'), 'shield'),
      wire('w11', t('bridge', 'ground'), t('ground', 'node'), 'ground'),
      wire('w12', t('bridge', 'shield'), t('ground', 'node'), 'shield'),
      wire('w13', t('neck-volume', 'ground'), t('ground', 'node'), 'ground'),
      wire('w14', t('bridge-volume', 'ground'), t('ground', 'node'), 'ground'),
      wire('w15', t('tone', 'ground'), t('ground', 'node'), 'ground'),
      wire('w16', t('ground', 'node'), t('jack', 'sleeve'), 'ground'),
    ],
  }
}
