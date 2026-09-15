import { definition } from './catalog'
import { splitTerminalKey, type Instance, type WireFactoryDocument } from './model'

export type Point = { x: number; y: number }
type Paint = { fill?: string; stroke?: string; strokeWidth?: number }
export type Primitive =
  | (Paint & { type: 'path'; d: string })
  | (Paint & { type: 'ellipse'; x: number; y: number; rx: number; ry: number })
  | { type: 'text'; x: number; y: number; text: string; size: number; fill: string }
export type Geometry = {
  width: number
  height: number
  terminals: Record<string, Point>
  primitives: Primitive[]
  svg: string
}
const palette = {
  metal: '#a9b5bf',
  edge: '#e2e8ec',
  dark: '#202a34',
  brass: '#d5af63',
  wafer: '#794c2d',
  ink: '#111d29',
  label: '#c6d2dc',
  contact: '#ffbc58',
}
const esc = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  )
export function primitiveSvg(p: Primitive): string {
  if (p.type === 'text')
    return (
      '<text x="' +
      p.x +
      '" y="' +
      p.y +
      '" text-anchor="middle" font-family="monospace" font-size="' +
      p.size +
      '" fill="' +
      p.fill +
      '">' +
      esc(p.text) +
      '</text>'
    )
  const paint =
    ' fill="' +
    (p.fill ?? 'none') +
    '" stroke="' +
    (p.stroke ?? 'none') +
    '" stroke-width="' +
    (p.strokeWidth ?? 1) +
    '" stroke-linecap="round" stroke-linejoin="round"'
  return p.type === 'path'
    ? '<path d="' + p.d + '"' + paint + '/>'
    : '<ellipse cx="' +
        p.x +
        '" cy="' +
        p.y +
        '" rx="' +
        p.rx +
        '" ry="' +
        p.ry +
        '"' +
        paint +
        '/>'
}
const shortLabels: Record<string, string> = {
  'north-start': 'NS',
  'north-finish': 'NF',
  'south-finish': 'SF',
  'south-start': 'SS',
  shield: 'SH',
  in: 'IN',
  out: 'W',
  ground: 'GND',
  'upper-in': 'U-IN',
  'upper-out': 'U-W',
  'upper-ground': 'U-G',
  'lower-in': 'L-IN',
  'lower-out': 'L-W',
  'lower-ground': 'L-G',
  neck: 'N',
  common: 'C',
  bridge: 'B',
  hot: 'HOT',
  tip: 'TIP',
  sleeve: 'SL',
  ring: 'R',
  node: 'GND',
}

// Original artwork in local display units. The three renderers consume these exact primitives.
export function componentGeometry(instance: Instance): Geometry {
  const item = definition(instance.definitionId)
  const id = instance.definitionId
  const primitives: Primitive[] = []
  const terminals: Record<string, Point> = {}
  let width = 190,
    height = 138
  const path = (d: string, fill?: string, stroke?: string, strokeWidth = 1) =>
    primitives.push({ type: 'path', d, fill, stroke, strokeWidth })
  const line = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color = palette.metal,
    weight = 2,
  ) => path('M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2, undefined, color, weight)
  const rect = (
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    stroke = palette.edge,
    r = 3,
  ) =>
    path(
      'M' +
        (x + r) +
        ' ' +
        y +
        'H' +
        (x + w - r) +
        'Q' +
        (x + w) +
        ' ' +
        y +
        ' ' +
        (x + w) +
        ' ' +
        (y + r) +
        'V' +
        (y + h - r) +
        'Q' +
        (x + w) +
        ' ' +
        (y + h) +
        ' ' +
        (x + w - r) +
        ' ' +
        (y + h) +
        'H' +
        (x + r) +
        'Q' +
        x +
        ' ' +
        (y + h) +
        ' ' +
        x +
        ' ' +
        (y + h - r) +
        'V' +
        (y + r) +
        'Q' +
        x +
        ' ' +
        y +
        ' ' +
        (x + r) +
        ' ' +
        y +
        'Z',
      fill,
      stroke,
    )
  const ellipse = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    fill: string,
    stroke = palette.edge,
    strokeWidth = 1,
  ) => primitives.push({ type: 'ellipse', x, y, rx, ry, fill, stroke, strokeWidth })
  const circle = (
    x: number,
    y: number,
    r: number,
    fill: string,
    stroke = palette.edge,
    strokeWidth = 1,
  ) => ellipse(x, y, r, r, fill, stroke, strokeWidth)
  const text = (x: number, y: number, value: string, size = 8, fill = palette.label) =>
    primitives.push({ type: 'text', x, y, text: value, size, fill })
  const screw = (x: number, y: number, r = 3) => {
    circle(x, y, r, palette.metal, palette.ink)
    line(x - r + 1, y, x + r - 1, y, palette.ink, 1)
  }
  const anchor = (name: string, x: number, y: number) => {
    terminals[name] = { x, y }
  }
  const contact = item?.contactModel
  const state = instance.controlState ?? contact?.defaultState ?? ''
  const stateIndex = Math.max(0, contact?.states.findIndex((s) => s.id === state) ?? 0)
  const isPush = id.startsWith('push-')
  const isPot = id.includes('pot') || id === 'no-load' || isPush
  const isPickup = ['single-coil', 'p90', 'hb-2c-braid', 'hb-4c-shield'].includes(id)

  if (isPickup) {
    const hum = id.startsWith('hb-')
    rect(7, 44, 176, 39, palette.metal, palette.edge, 7)
    screw(13, 63)
    screw(177, 63)
    if (hum) {
      rect(21, 30, 148, 64, palette.ink, palette.brass, 9)
      rect(24, 33, 142, 27, '#27313b', '#77828a', 7)
      rect(24, 62, 142, 27, '#171d24', '#77828a', 7)
      for (let n = 0; n < 6; n++) {
        screw(37 + n * 23, 46, 4)
        circle(37 + n * 23, 75, 3.6, palette.metal, '#697581')
      }
    } else {
      rect(
        21,
        id === 'p90' ? 31 : 45,
        148,
        id === 'p90' ? 59 : 31,
        id === 'p90' ? '#e3d6b6' : '#dddccf',
        '#929087',
        12,
      )
      for (let n = 0; n < 6; n++) screw(37 + n * 23, id === 'p90' ? 63 : 60, 3.7)
      if (id === 'p90') {
        screw(32, 43, 2.5)
        screw(158, 43, 2.5)
      }
    }
    const pins = item!.terminals
    pins.forEach((p, n) => {
      const x = pins.length === 5 ? 23 + n * 36 : 40 + n * 55
      anchor(p.id, x, 116)
      line(
        x,
        hum || id === 'p90' ? 94 : 83,
        x,
        110,
        p.id === 'shield' ? palette.metal : palette.brass,
        2,
      )
    })
  } else if (isPot) {
    height = isPush ? 222 : id === 'stacked-pot' ? 184 : 138
    const potBack = (cy: number) => {
      circle(95, cy, 33, palette.metal, '#eef0e5', 2)
      circle(95, cy, 28, '#8c9ba3', '#55636d')
      for (let n = 0; n < 8; n++) {
        const a = (n * Math.PI) / 4
        line(
          95 + 28 * Math.cos(a),
          cy + 28 * Math.sin(a),
          95 + 32 * Math.cos(a),
          cy + 32 * Math.sin(a),
          '#647078',
          2,
        )
      }
      circle(95, cy, 11, palette.dark, palette.brass, 2)
    }
    if (id === 'stacked-pot') {
      potBack(90)
      potBack(55)
      circle(95, 55, 6, palette.metal)
      for (let row = 0; row < 2; row++)
        for (let n = 0; n < 3; n++) {
          const x = 57 + n * 38,
            y = 138 + row * 28
          rect(x - 5, y - 13, 10, 18, palette.brass, '#eee0ab', 2)
          anchor((row === 0 ? 'upper-' : 'lower-') + ['in', 'out', 'ground'][n], x, y)
        }
      text(150, 65, 'UPPER', 7)
      text(150, 103, 'LOWER', 7)
    } else {
      potBack(64)
      text(
        95,
        87,
        id === 'no-load' ? 'NO LOAD' : (instance.values.resistance ?? 'POT'),
        7,
        palette.ink,
      )
      for (let n = 0; n < 3; n++) {
        const x = 57 + n * 38
        rect(x - 5, 96, 10, 23, palette.brass, '#eee0ab', 2)
        anchor(['in', 'out', 'ground'][n], x, 113)
      }
      if (isPush) {
        const raised = state === 'split'
        rect(89, raised ? 22 : 29, 12, raised ? 18 : 11, palette.metal, palette.edge, 2)
        rect(84, raised ? 21 : 28, 22, 7, palette.dark, palette.edge, 2)
        text(
          153,
          47,
          id === 'push-pull-dpdt' ? (raised ? 'PULL' : 'PUSH') : raised ? 'LATCH B' : 'LATCH A',
          7,
        )
        rect(51, 135, 88, 69, palette.wafer, palette.brass, 5)
        for (let col = 0; col < 2; col++)
          for (let row = 0; row < 3; row++) {
            const x = 65 + col * 60,
              y = 147 + row * 25
            rect(x - 5, y - 7, 10, 14, palette.brass, '#e7cc90', 2)
            anchor((col === 0 ? 'a' : 'b') + (row + 1), x, y)
          }
      }
    }
  } else if (id.includes('blade') || id === 'four-pole-five-throw') {
    const superSwitch = id === 'four-pole-five-throw'
    width = superSwitch ? 270 : 218
    height = superSwitch ? 222 : 155
    const rows = superSwitch ? 4 : 2,
      cols = superSwitch ? 6 : 4
    for (let row = 0; row < rows; row++) {
      const y = 80 + row * 34
      rect(14, y - 10, width - 28, 25, row % 2 ? '#68412b' : palette.wafer, palette.brass, 4)
      for (let col = 0; col < cols; col++) {
        const x = 26 + (col * (width - 52)) / (cols - 1)
        anchor(String.fromCharCode(97 + row) + (superSwitch ? (col === 0 ? 'c' : col) : col), x, y)
      }
    }
    rect(20, 43, width - 40, 10, palette.metal, palette.edge, 4)
    screw(26, 48)
    screw(width - 26, 48)
    const tipX = 42 + (stateIndex * (width - 84)) / Math.max(1, (contact?.states.length ?? 1) - 1)
    line(width / 2, 65, tipX, 28, palette.metal, 5)
    rect(tipX - 6, 23, 12, 17, palette.dark, palette.edge, 4)
  } else if (item?.category === 'Switches') {
    const dpdt = id.startsWith('dpdt')
    height = dpdt ? 190 : 150
    const cx = 95,
      tipX = contact?.states.length === 2 ? (stateIndex === 0 ? 65 : 125) : 65 + stateIndex * 30
    rect(60, 80, 70, 26, '#7f8c98', palette.edge, 5)
    circle(cx, 73, 17, palette.metal, '#e6edf1', 2)
    circle(cx, 73, 10, palette.dark, palette.brass)
    line(cx, 66, tipX, 36, palette.metal, 6)
    ellipse(tipX, 33, 7, 10, '#e8e3d2', '#929a9e', 1.5)
    if (dpdt) {
      rect(50, 102, 90, 70, palette.wafer, palette.brass, 4)
      for (let col = 0; col < 2; col++)
        for (let row = 0; row < 3; row++)
          anchor((col === 0 ? 'a' : 'b') + (row + 1), 65 + col * 60, 114 + row * 25)
    } else {
      item!.terminals.forEach((pin, n) => {
        const x = item!.terminals.length === 2 ? 65 + n * 60 : 55 + n * 40
        line(x, 106, x, 122, palette.brass, 3)
        anchor(pin.id, x, 126)
      })
    }
  } else if (id.includes('jack')) {
    rect(54, 48, 67, 43, '#75858e', palette.edge, 5)
    ellipse(54, 69, 23, 28, palette.metal, palette.edge, 2)
    ellipse(54, 69, 16, 21, palette.brass, '#776644', 2)
    ellipse(54, 69, 10, 15, palette.ink, '#53606a')
    path('M89 53L146 72L146 110', undefined, palette.brass, 3)
    line(54, 95, 54, 110, palette.brass, 3)
    anchor('tip', 146, 115)
    anchor('sleeve', 54, 115)
    if (id === 'stereo-jack') {
      path('M86 85L108 94V110', undefined, palette.brass, 3)
      anchor('ring', 108, 115)
    }
  } else if (['capacitor', 'resistor', 'treble-bleed'].includes(id)) {
    height = 128
    const resistor = (y: number) => {
      rect(54, y - 13, 82, 26, '#d9c5a0', '#f3dcad', 8)
      ;['#783e2d', '#222b34', '#d7782b', '#cfa94d'].forEach((c, n) =>
        rect(66 + n * 17, y - 12, 6, 24, c, c, 0),
      )
    }
    const capacitor = (y: number) => {
      rect(62, y - 15, 66, 30, '#db8641', '#f3bb71', 8)
      text(95, y + 3, instance.values.capacitance ?? '22nF', 8, '#302517')
    }
    const cy = id === 'treble-bleed' ? 44 : 62
    if (id !== 'resistor') capacitor(cy)
    if (id !== 'capacitor') resistor(id === 'treble-bleed' ? 79 : cy)
    for (const x of [25, 165]) {
      const edge = x === 25 ? (id === 'resistor' ? 54 : 62) : id === 'resistor' ? 136 : 128
      path('M' + edge + ' ' + cy + 'H' + x + 'V101', undefined, palette.metal, 2)
      if (id === 'treble-bleed') line(x === 25 ? 54 : 136, 79, x, 79)
    }
    anchor('a', 25, 104)
    anchor('b', 165, 104)
  } else if (id === 'bridge-ground') {
    rect(20, 43, 150, 42, palette.metal, palette.edge, 5)
    for (let n = 0; n < 6; n++) {
      rect(34 + n * 23, 50, 12, 24, '#697b85', '#ced8dc', 2)
      line(40 + n * 23, 33, 40 + n * 23, 92, '#d7c18d', 1)
    }
    line(95, 86, 95, 108, palette.brass, 3)
    anchor('ground', 95, 112)
  } else if (id === 'shield') {
    path('M25 35L142 29L168 53L159 95L29 90L21 61Z', '#ba8058', '#ecc6a0', 2)
    for (let n = 0; n < 6; n++) line(33 + n * 21, 40, 33 + n * 21, 85, '#d39a6c', 1)
    line(95, 92, 95, 108, palette.brass, 3)
    anchor('ground', 95, 112)
  } else {
    // The only remaining canonical definition is the solder junction.
    circle(95, 63, 14, '#c5c9c4', palette.edge, 2)
    for (let n = 0; n < 6; n++) {
      const a = (n * Math.PI) / 3
      line(
        95 + 14 * Math.cos(a),
        63 + 14 * Math.sin(a),
        95 + 25 * Math.cos(a),
        63 + 25 * Math.sin(a),
        palette.brass,
        3,
      )
    }
    line(95, 77, 95, 104, palette.brass, 3)
    anchor('node', 95, 109)
  }
  // Closed contacts are shown between the same anchors used by the wire editor.
  for (const [a, b] of contact?.states.find((s) => s.id === state)?.pairs ?? []) {
    const p = terminals[a],
      q = terminals[b]
    if (!p || !q) continue
    if (p.y === q.y)
      path(
        'M' + p.x + ' ' + p.y + 'V' + (p.y - 8) + 'H' + q.x + 'V' + q.y,
        undefined,
        palette.contact,
        2.5,
      )
    else line(p.x, p.y, q.x, q.y, palette.contact, 2.5)
  }
  for (const pin of item?.terminals ?? []) {
    const p = terminals[pin.id]
    if (!p) throw new Error('Artwork anchor missing: ' + id + ':' + pin.id)
    circle(p.x, p.y, 4.7, palette.ink, palette.brass, 1.7)
    text(p.x, p.y + 14, shortLabels[pin.id] ?? pin.id.toUpperCase(), 7)
  }
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" class="component-art" viewBox="0 0 ' +
    width +
    ' ' +
    height +
    '" role="img" aria-label="' +
    esc(item?.name ?? id) +
    '">' +
    primitives.map(primitiveSvg).join('') +
    '</svg>'
  return { width, height, terminals, primitives, svg }
}
export const componentHeight = (instance: Instance) => componentGeometry(instance).height
export const componentWidth = (instance: Instance) => componentGeometry(instance).width
export const terminalLocalPosition = (instance: Instance, terminalId: string) =>
  componentGeometry(instance).terminals[terminalId] ?? null
export const terminalPosition = (doc: WireFactoryDocument, key: string) => {
  const [id, pin] = splitTerminalKey(key),
    item = doc.instances.find((entry) => entry.id === id)
  const local = item ? terminalLocalPosition(item, pin) : null
  return item && local ? { x: item.x + local.x, y: item.y + local.y } : null
}
export const renderComponentSvg = (instance: Instance) => componentGeometry(instance).svg
