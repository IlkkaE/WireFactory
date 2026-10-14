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

const potValues = (control: string, resistance = '250k') => ({
  resistance,
  taper: 'audio',
  control,
})

/**
 * Split-coil guitar (one coil per three strings): a bass half (E-A-D) and a treble half (G-B-e),
 * each with its own volume and tone, delivered as true stereo on a TRS jack.
 * Tip = bass half, Ring = treble half, Sleeve = common ground. Use a TRS Y-cable.
 */
export function splitCoilStereoDocument(): WireFactoryDocument {
  const t = terminalKey
  return {
    format: FORMAT,
    version: VERSION,
    title: 'Split-coil / stereo TRS / 2V / 2T',
    expectation: null,
    junctions: [],
    instances: [
      component('bass', 'single-coil', 'Bass coil (E-A-D)', 35, 55, { position: 'bass' }),
      component('treble', 'single-coil', 'Treble coil (G-B-e)', 35, 345, { position: 'treble' }),
      component('bass-volume', 'pot-250k-audio', 'Bass volume', 255, 55, potValues('bass-volume')),
      component(
        'treble-volume',
        'pot-250k-audio',
        'Treble volume',
        255,
        345,
        potValues('treble-volume'),
      ),
      component('bass-tone', 'pot-250k-audio', 'Bass tone', 475, 55, potValues('bass-tone')),
      component('bass-cap', 'capacitor', 'Bass tone capacitor 22 nF', 475, 210, {
        capacitance: '22nF',
      }),
      component('treble-tone', 'pot-250k-audio', 'Treble tone', 475, 345, potValues('treble-tone')),
      component('treble-cap', 'capacitor', 'Treble tone capacitor 22 nF', 475, 500, {
        capacitance: '22nF',
      }),
      component('jack', 'stereo-jack', 'Stereo output jack (TRS)', 700, 190),
      component('ground', 'junction', 'Common ground', 475, 660),
    ],
    wires: [
      wire('w01', t('bass', 'hot'), t('bass-volume', 'in'), 'signal'),
      wire('w02', t('bass-volume', 'out'), t('jack', 'tip'), 'signal'),
      wire('w03', t('bass-volume', 'in'), t('bass-tone', 'in'), 'tone'),
      wire('w04', t('bass-tone', 'out'), t('bass-cap', 'a'), 'tone'),
      wire('w05', t('bass-cap', 'b'), t('ground', 'node'), 'ground'),
      wire('w06', t('treble', 'hot'), t('treble-volume', 'in'), 'signal'),
      wire('w07', t('treble-volume', 'out'), t('jack', 'ring'), 'signal'),
      wire('w08', t('treble-volume', 'in'), t('treble-tone', 'in'), 'tone'),
      wire('w09', t('treble-tone', 'out'), t('treble-cap', 'a'), 'tone'),
      wire('w10', t('treble-cap', 'b'), t('ground', 'node'), 'ground'),
      wire('w11', t('bass', 'ground'), t('ground', 'node'), 'ground'),
      wire('w12', t('bass', 'shield'), t('ground', 'node'), 'shield'),
      wire('w13', t('treble', 'ground'), t('ground', 'node'), 'ground'),
      wire('w14', t('treble', 'shield'), t('ground', 'node'), 'shield'),
      wire('w15', t('bass-volume', 'ground'), t('ground', 'node'), 'ground'),
      wire('w16', t('treble-volume', 'ground'), t('ground', 'node'), 'ground'),
      wire('w17', t('bass-tone', 'ground'), t('ground', 'node'), 'ground'),
      wire('w18', t('treble-tone', 'ground'), t('ground', 'node'), 'ground'),
      wire('w19', t('ground', 'node'), t('jack', 'sleeve'), 'ground'),
    ],
  }
}

/**
 * Split-coil guitar in mono: a DPDT switch selects parallel (bright, lower output) or series
 * (full, hot output) for the two halves, plus a kill switch per half and a master volume/tone.
 * In series mode the treble half sits between the bass half and ground, so the treble kill
 * switch also mutes the bass half's contribution to the chain.
 */
export function splitCoilMonoDocument(): WireFactoryDocument {
  const t = terminalKey
  return {
    format: FORMAT,
    version: VERSION,
    title: 'Split-coil / mono series-parallel / kill switches',
    expectation: null,
    junctions: [],
    instances: [
      component('bass', 'single-coil', 'Bass coil (E-A-D)', 35, 55, { position: 'bass' }),
      component('treble', 'single-coil', 'Treble coil (G-B-e)', 35, 345, { position: 'treble' }),
      component('series-parallel', 'dpdt-on-on', 'Parallel / series switch', 255, 190, {
        switchSemantics: 'series-parallel',
      }),
      component('bass-kill', 'spst-on-off', 'Bass kill switch', 255, 20),
      component('treble-kill', 'spst-on-off', 'Treble kill switch', 255, 470),
      component('master-volume', 'pot-250k-audio', 'Master volume', 475, 55, {
        ...potValues('master-volume'),
      }),
      component('tone', 'pot-250k-audio', 'Master tone', 475, 305, potValues('tone')),
      component('cap', 'capacitor', '22 nF tone capacitor', 475, 485, { capacitance: '22nF' }),
      component('jack', 'mono-jack', 'Mono output jack', 700, 55),
      component('ground', 'junction', 'Common ground', 475, 650),
    ],
    wires: [
      wire('w01', t('bass', 'hot'), t('master-volume', 'in'), 'signal'),
      wire('w02', t('bass', 'ground'), t('series-parallel', 'a2'), 'signal'),
      wire('w03', t('treble', 'hot'), t('series-parallel', 'b2'), 'signal'),
      wire('w04', t('treble', 'ground'), t('ground', 'node'), 'ground'),
      wire('w05', t('series-parallel', 'a1'), t('ground', 'node'), 'ground'),
      wire('w06', t('series-parallel', 'b1'), t('master-volume', 'in'), 'signal'),
      wire('w07', t('series-parallel', 'a3'), t('series-parallel', 'b3'), 'signal'),
      wire('w08', t('master-volume', 'out'), t('jack', 'tip'), 'signal'),
      wire('w09', t('master-volume', 'in'), t('tone', 'in'), 'tone'),
      wire('w10', t('tone', 'out'), t('cap', 'a'), 'tone'),
      wire('w11', t('cap', 'b'), t('ground', 'node'), 'ground'),
      wire('w12', t('bass', 'shield'), t('ground', 'node'), 'shield'),
      wire('w13', t('treble', 'shield'), t('ground', 'node'), 'shield'),
      wire('w14', t('master-volume', 'ground'), t('ground', 'node'), 'ground'),
      wire('w15', t('tone', 'ground'), t('ground', 'node'), 'ground'),
      wire('w16', t('ground', 'node'), t('jack', 'sleeve'), 'ground'),
      wire('w17', t('bass-kill', 'a'), t('master-volume', 'in'), 'signal'),
      wire('w18', t('bass-kill', 'b'), t('ground', 'node'), 'ground'),
      wire('w19', t('treble-kill', 'a'), t('series-parallel', 'b2'), 'signal'),
      wire('w20', t('treble-kill', 'b'), t('ground', 'node'), 'ground'),
    ],
  }
}

/**
 * Split-coil guitar, two push/pull volume pots and a TRS jack.
 * - Bass volume push/pull = Mono (down) / Stereo (up): the treble signal goes to Tip (mono,
 *   mixed with the bass half) or to Ring (stereo, use a TRS Y-cable).
 * - Treble volume push/pull = Parallel (down) / Series (up) for the two coils. Use series only
 *   in mono mode: in series the bass volume is bypassed and the treble volume acts as master.
 */
export function splitCoilPushPullDocument(): WireFactoryDocument {
  const t = terminalKey
  return {
    format: FORMAT,
    version: VERSION,
    title: 'Split-coil / TRS / push-pull mono-stereo + series-parallel',
    expectation: null,
    junctions: [],
    instances: [
      component('bass', 'single-coil', 'Bass coil (E-A-D)', 35, 55, { position: 'bass' }),
      component('treble', 'single-coil', 'Treble coil (G-B-e)', 35, 345, { position: 'treble' }),
      {
        ...component(
          'bass-volume',
          'push-pull-dpdt',
          'Bass volume (push/pull: mono / stereo)',
          475,
          55,
          potValues('bass-volume'),
        ),
        controlState: 'full',
      },
      {
        ...component(
          'treble-volume',
          'push-pull-dpdt',
          'Treble volume (push/pull: parallel / series)',
          255,
          345,
          potValues('treble-volume'),
        ),
        controlState: 'full',
      },
      component('jack', 'stereo-jack', 'Stereo output jack (TRS)', 700, 190),
      component('ground', 'junction', 'Common ground', 475, 560),
    ],
    wires: [
      wire('w01', t('treble', 'hot'), t('treble-volume', 'in'), 'signal'),
      wire('w02', t('treble', 'ground'), t('treble-volume', 'a2'), 'signal'),
      wire('w03', t('treble-volume', 'a1'), t('ground', 'node'), 'ground'),
      wire('w04', t('treble-volume', 'a3'), t('bass', 'hot'), 'signal'),
      wire('w05', t('bass', 'hot'), t('treble-volume', 'b2'), 'signal'),
      wire('w06', t('treble-volume', 'b1'), t('bass-volume', 'in'), 'signal'),
      wire('w07', t('bass', 'ground'), t('ground', 'node'), 'ground'),
      wire('w08', t('bass-volume', 'out'), t('jack', 'tip'), 'signal'),
      wire('w09', t('treble-volume', 'out'), t('bass-volume', 'a2'), 'signal'),
      wire('w10', t('bass-volume', 'a1'), t('jack', 'tip'), 'signal'),
      wire('w11', t('bass-volume', 'a3'), t('jack', 'ring'), 'signal'),
      wire('w12', t('bass', 'shield'), t('ground', 'node'), 'shield'),
      wire('w13', t('treble', 'shield'), t('ground', 'node'), 'shield'),
      wire('w14', t('bass-volume', 'ground'), t('ground', 'node'), 'ground'),
      wire('w15', t('treble-volume', 'ground'), t('ground', 'node'), 'ground'),
      wire('w16', t('ground', 'node'), t('jack', 'sleeve'), 'ground'),
    ],
  }
}
