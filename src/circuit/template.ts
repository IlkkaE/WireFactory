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
const colors: Record<Wire['role'], string> = {
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
  color: colors[role],
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
      component('cap', 'capacitor', '22 nF tone capacitor', 700, 430, { capacitance: '22nF' }),
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

export function masterVolumeDocument(): WireFactoryDocument {
  const t = terminalKey
  return {
    format: FORMAT,
    version: VERSION,
    title: '2HB / 1V / 1T',
    expectation: { id: '2hb-1v-1t', version: 1 },
    junctions: [],
    instances: [
      component('neck', 'hb-2c-braid', 'Neck humbucker', 35, 55, { position: 'neck' }),
      component('bridge', 'hb-2c-braid', 'Bridge humbucker', 35, 275, { position: 'bridge' }),
      component('selector', 'three-way-toggle', '3-way selector', 255, 165, {
        control: 'selector',
      }),
      component('master-volume', 'pot-500k-audio', 'Master volume', 475, 55, {
        resistance: '500k',
        taper: 'audio',
        control: 'master-volume',
      }),
      component('tone', 'pot-500k-audio', 'Master tone', 475, 275, {
        resistance: '500k',
        taper: 'audio',
        control: 'tone',
      }),
      component('cap', 'capacitor', '22 nF tone capacitor', 475, 430, { capacitance: '22nF' }),
      component('jack', 'mono-jack', 'Mono output jack', 700, 55),
      component('ground', 'junction', 'Common ground', 475, 555),
    ],
    wires: [
      wire('w01', t('neck', 'hot'), t('selector', 'neck'), 'signal'),
      wire('w02', t('bridge', 'hot'), t('selector', 'bridge'), 'signal'),
      wire('w03', t('selector', 'common'), t('master-volume', 'in'), 'signal'),
      wire('w04', t('master-volume', 'out'), t('jack', 'tip'), 'signal'),
      wire('w05', t('selector', 'common'), t('tone', 'in'), 'tone'),
      wire('w06', t('tone', 'out'), t('cap', 'a'), 'tone'),
      wire('w07', t('cap', 'b'), t('ground', 'node'), 'ground'),
      wire('w08', t('neck', 'ground'), t('ground', 'node'), 'ground'),
      wire('w09', t('neck', 'shield'), t('ground', 'node'), 'shield'),
      wire('w10', t('bridge', 'ground'), t('ground', 'node'), 'ground'),
      wire('w11', t('bridge', 'shield'), t('ground', 'node'), 'shield'),
      wire('w12', t('master-volume', 'ground'), t('ground', 'node'), 'ground'),
      wire('w13', t('tone', 'ground'), t('ground', 'node'), 'ground'),
      wire('w14', t('ground', 'node'), t('jack', 'sleeve'), 'ground'),
    ],
  }
}

export function splitDocument(
  kind: 'push-pull-dpdt' | 'push-push-dpdt' = 'push-pull-dpdt',
): WireFactoryDocument {
  const t = terminalKey
  const doc = masterVolumeDocument()
  doc.title =
    kind === 'push-pull-dpdt'
      ? '2HB / 1V / 1T / dual split push-pull'
      : '2HB / 1V / 1T / dual split push-push'
  doc.expectation = {
    id: kind === 'push-pull-dpdt' ? '2hb-1v-1t-split-push-pull' : '2hb-1v-1t-split-push-push',
    version: 1,
  }
  for (const id of ['neck', 'bridge']) {
    const pickup = doc.instances.find((item) => item.id === id)!
    pickup.definitionId = 'hb-4c-shield'
    pickup.pinoutId = 'hb-4c-shield-generic'
  }
  const tone = doc.instances.find((item) => item.id === 'tone')!
  tone.definitionId = kind
  tone.pinoutId = kind + '-generic'
  tone.controlState = 'full'
  tone.y = 255
  doc.instances.find((item) => item.id === 'cap')!.y = 500
  doc.instances.find((item) => item.id === 'ground')!.y = 650
  const remap = (key: string) =>
    key.replace(
      /^(neck|bridge):(hot|ground)$/,
      (_, id, pin) => id + ':' + (pin === 'hot' ? 'north-start' : 'south-start'),
    )
  doc.wires = doc.wires.map((entry) => ({ ...entry, from: remap(entry.from), to: remap(entry.to) }))
  doc.wires.push(
    wire('w15', t('neck', 'north-finish'), t('neck', 'south-finish'), 'signal'),
    wire('w16', t('bridge', 'north-finish'), t('bridge', 'south-finish'), 'signal'),
    wire('w17', t('neck', 'north-finish'), t('tone', 'a2'), 'signal'),
    wire('w18', t('bridge', 'north-finish'), t('tone', 'b2'), 'signal'),
    wire('w19', t('tone', 'a3'), t('ground', 'node'), 'ground'),
    wire('w20', t('tone', 'b3'), t('ground', 'node'), 'ground'),
  )
  return doc
}

export function fiveWaySingleCoilDocument(): WireFactoryDocument {
  const t = terminalKey
  return {
    format: FORMAT,
    version: VERSION,
    title: '3S / 5-way / 1V / 1T',
    expectation: null,
    junctions: [],
    instances: [
      component('neck', 'single-coil', 'Neck single-coil', 35, 35, { position: 'neck' }),
      component('middle', 'single-coil', 'Middle single-coil', 35, 225, { position: 'middle' }),
      component('bridge', 'single-coil', 'Bridge single-coil', 35, 415, { position: 'bridge' }),
      component('selector', 'five-way-blade', '5-way selector', 255, 225, {}),
      component('master-volume', 'pot-250k-audio', 'Master volume', 475, 35, {
        resistance: '250k',
        taper: 'audio',
        control: 'master-volume',
      }),
      component('tone', 'pot-250k-audio', 'Master tone', 475, 265, {
        resistance: '250k',
        taper: 'audio',
        control: 'tone',
      }),
      component('cap', 'capacitor', '22 nF tone capacitor', 475, 440, { capacitance: '22nF' }),
      component('jack', 'mono-jack', 'Mono output jack', 700, 35),
      component('ground', 'junction', 'Common ground', 475, 610),
    ],
    wires: [
      wire('w01', t('neck', 'hot'), t('selector', 'a1'), 'signal'),
      wire('w02', t('middle', 'hot'), t('selector', 'a2'), 'signal'),
      wire('w03', t('bridge', 'hot'), t('selector', 'a3'), 'signal'),
      wire('w04', t('selector', 'a0'), t('master-volume', 'in'), 'signal'),
      wire('w05', t('master-volume', 'out'), t('jack', 'tip'), 'signal'),
      wire('w06', t('selector', 'a0'), t('tone', 'in'), 'tone'),
      wire('w07', t('tone', 'out'), t('cap', 'a'), 'tone'),
      wire('w08', t('cap', 'b'), t('ground', 'node'), 'ground'),
      wire('w09', t('neck', 'ground'), t('ground', 'node'), 'ground'),
      wire('w10', t('middle', 'ground'), t('ground', 'node'), 'ground'),
      wire('w11', t('bridge', 'ground'), t('ground', 'node'), 'ground'),
      wire('w12', t('neck', 'shield'), t('ground', 'node'), 'shield'),
      wire('w13', t('middle', 'shield'), t('ground', 'node'), 'shield'),
      wire('w14', t('bridge', 'shield'), t('ground', 'node'), 'shield'),
      wire('w15', t('master-volume', 'ground'), t('ground', 'node'), 'ground'),
      wire('w16', t('tone', 'ground'), t('ground', 'node'), 'ground'),
      wire('w17', t('ground', 'node'), t('jack', 'sleeve'), 'ground'),
    ],
  }
}

export function seriesParallelDocument(): WireFactoryDocument {
  const t = terminalKey
  return {
    format: FORMAT,
    version: VERSION,
    title: '2S / Parallel-Series / 1V / 1T',
    expectation: null,
    junctions: [],
    instances: [
      component('neck', 'single-coil', 'Neck single-coil', 35, 55, { position: 'neck' }),
      component('bridge', 'single-coil', 'Bridge single-coil', 35, 305, { position: 'bridge' }),
      component('series-parallel', 'dpdt-on-on', 'Parallel / series switch', 255, 170, {
        switchSemantics: 'series-parallel',
      }),
      component('master-volume', 'pot-250k-audio', 'Master volume', 475, 55, {
        resistance: '250k',
        taper: 'audio',
        control: 'master-volume',
      }),
      component('tone', 'pot-250k-audio', 'Master tone', 475, 305, {
        resistance: '250k',
        taper: 'audio',
        control: 'tone',
      }),
      component('cap', 'capacitor', '22 nF tone capacitor', 475, 485, { capacitance: '22nF' }),
      component('jack', 'mono-jack', 'Mono output jack', 700, 55),
      component('ground', 'junction', 'Common ground', 475, 650),
    ],
    wires: [
      wire('w01', t('neck', 'hot'), t('master-volume', 'in'), 'signal'),
      wire('w02', t('neck', 'ground'), t('series-parallel', 'a2'), 'signal'),
      wire('w03', t('bridge', 'hot'), t('series-parallel', 'b2'), 'signal'),
      wire('w04', t('bridge', 'ground'), t('ground', 'node'), 'ground'),
      wire('w05', t('series-parallel', 'a1'), t('ground', 'node'), 'ground'),
      wire('w06', t('series-parallel', 'b1'), t('master-volume', 'in'), 'signal'),
      wire('w07', t('series-parallel', 'a3'), t('series-parallel', 'b3'), 'signal'),
      wire('w08', t('master-volume', 'out'), t('jack', 'tip'), 'signal'),
      wire('w09', t('master-volume', 'in'), t('tone', 'in'), 'tone'),
      wire('w10', t('tone', 'out'), t('cap', 'a'), 'tone'),
      wire('w11', t('cap', 'b'), t('ground', 'node'), 'ground'),
      wire('w12', t('neck', 'shield'), t('ground', 'node'), 'shield'),
      wire('w13', t('bridge', 'shield'), t('ground', 'node'), 'shield'),
      wire('w14', t('master-volume', 'ground'), t('ground', 'node'), 'ground'),
      wire('w15', t('tone', 'ground'), t('ground', 'node'), 'ground'),
      wire('w16', t('ground', 'node'), t('jack', 'sleeve'), 'ground'),
    ],
  }
}
