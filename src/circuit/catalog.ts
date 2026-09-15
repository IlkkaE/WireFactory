import type { Definition, RuntimeBehavior, TerminalRole } from './model'

type Source = { label: string; url: string }
type Terminal = { id: string; role: TerminalRole; label: string }

const PICKUP: Source = {
  label: 'Seymour Duncan wiring diagram library',
  url: 'https://www.seymourduncan.com/resources/pickup/wiring-diagrams',
}
const SWITCH: Source = {
  label: 'Switchcraft 12000 series selector documentation',
  url: 'https://www.switchcraft.com/file.aspx?DocumentId=258',
}
const JACK: Source = {
  label: 'Neutrik plugs and jacks product guide',
  url: 'https://www.neutrik.com/media/10096/download/02%20Neutrik%20PG%20EN%20-%20Section%20Plugs%20%26%20Jacks%20-%20202110-V24.pdf?v=9',
}
const POT: Source = {
  label: 'CTS 450G guitar potentiometer documentation',
  url: 'https://www.ctscorp.com/Product-Series/450G.htm',
}

const make = (
  id: string,
  name: string,
  category: string,
  summary: string,
  example: string,
  terminals: Terminal[],
  source: Source = PICKUP,
  limitation = 'Generic schematic symbol. Confirm the physical component pinout before soldering.',
  starterVerified = false,
  behavior: RuntimeBehavior = 'unsupported',
  contactModel?: Definition['contactModel'],
): Definition => ({
  id,
  version: 1,
  name,
  category,
  summary,
  example,
  terminals,
  source: source.label,
  sourceUrl: source.url,
  limitation,
  starterVerified,
  behavior,
  ...(contactModel ? { contactModel } : {}),
})

const pickup: Terminal[] = [
  { id: 'hot', role: 'hot', label: 'Hot' },
  { id: 'ground', role: 'ground', label: 'Cold / ground' },
  { id: 'shield', role: 'shield', label: 'Shield' },
]
const humbucker4: Terminal[] = [
  { id: 'north-start', role: 'hot', label: 'North start' },
  { id: 'north-finish', role: 'component', label: 'North finish' },
  { id: 'south-finish', role: 'component', label: 'South finish' },
  { id: 'south-start', role: 'ground', label: 'South start' },
  { id: 'shield', role: 'shield', label: 'Shield' },
]
const pot: Terminal[] = [
  { id: 'in', role: 'signal', label: 'Input lug' },
  { id: 'out', role: 'signal', label: 'Wiper' },
  { id: 'ground', role: 'ground', label: 'Ground lug' },
]
const contacts = (ids: string[]): Terminal[] =>
  ids.map((id) => ({ id, role: 'contact', label: id.toUpperCase() }))
const twoPoleBlade = contacts(['a0', 'a1', 'a2', 'a3', 'b0', 'b1', 'b2', 'b3'])
const dpdt = contacts(['a1', 'a2', 'a3', 'b1', 'b2', 'b3'])
const superSwitch = ['a', 'b', 'c', 'd'].flatMap((pole) =>
  contacts(['c', '1', '2', '3', '4', '5'].map((position) => `${pole}${position}`)),
)

export const catalog: Definition[] = [
  make(
    'single-coil',
    'Single-coil pickup',
    'Pickups',
    'Two-lead magnetic pickup plus an optional shield.',
    'Traditional neck, middle or bridge pickup.',
    pickup,
  ),
  make(
    'p90',
    'P-90 pickup',
    'Pickups',
    'Single-coil pickup in a wider P-90 format.',
    'P-90 neck or bridge circuit.',
    pickup,
  ),
  make(
    'hb-2c-braid',
    'Humbucker, 2-conductor + braid',
    'Pickups',
    'Series-wired humbucker with hot, cold and shield connections.',
    'Conventional full humbucker without coil switching.',
    pickup,
    PICKUP,
    'The braid may combine signal cold and shield; verify the maker drawing.',
    true,
    'pickup',
  ),
  make(
    'hb-4c-shield',
    'Humbucker, 4-conductor + shield',
    'Pickups',
    'Both coil starts and finishes are available independently.',
    'Coil split, series/parallel or phase switching.',
    humbucker4,
    PICKUP,
    'Wire colours are not universal. Use the pickup maker’s colour code.',
  ),
  make(
    'pot-250k-audio',
    '250k audio potentiometer',
    'Controls',
    'Logarithmic three-lug potentiometer.',
    'Common volume or tone control for single-coil circuits.',
    pot,
    POT,
  ),
  make(
    'pot-500k-audio',
    '500k audio potentiometer',
    'Controls',
    'Logarithmic three-lug potentiometer.',
    'Common humbucker volume or tone control.',
    pot,
    POT,
    'Lug order depends on viewing direction; confirm it physically.',
    true,
    'potentiometer',
  ),
  make(
    'pot-1m-audio',
    '1M audio potentiometer',
    'Controls',
    'High-value logarithmic potentiometer.',
    'A lightly loaded volume control for a brighter response.',
    pot,
    POT,
  ),
  make(
    'pot-250k-linear',
    '250k linear potentiometer',
    'Controls',
    'Linear three-lug potentiometer.',
    'Blend or specialty control where a linear law is wanted.',
    pot,
    POT,
  ),
  make(
    'pot-500k-linear',
    '500k linear potentiometer',
    'Controls',
    'Linear three-lug potentiometer.',
    'Blend or specialty control in a humbucker circuit.',
    pot,
    POT,
  ),
  make(
    'pot-1m-linear',
    '1M linear potentiometer',
    'Controls',
    'High-value linear three-lug potentiometer.',
    'Experimental blend or load control.',
    pot,
    POT,
  ),
  make(
    'stacked-pot',
    'Stacked / concentric potentiometer',
    'Controls',
    'Two independent three-lug controls on one shaft.',
    'Concentric volume and tone control.',
    [
      ...pot.map((t) => ({ ...t, id: 'upper-' + t.id, label: 'Upper ' + t.label })),
      ...pot.map((t) => ({ ...t, id: 'lower-' + t.id, label: 'Lower ' + t.label })),
    ],
    POT,
    'Generic dual-gang symbol; confirm shaft and lug orientation.',
  ),
  make(
    'no-load',
    'No-load tone potentiometer',
    'Controls',
    'Tone control that opens its resistive track at maximum.',
    'Remove the tone-pot load at setting 10.',
    pot,
    POT,
  ),
  make(
    'three-way-toggle',
    '3-way pickup toggle',
    'Switches',
    'Neck, both and bridge selector with a common output.',
    'Select two pickups in a 2-pickup guitar.',
    [
      { id: 'neck', role: 'contact', label: 'Neck' },
      { id: 'common', role: 'contact', label: 'Common' },
      { id: 'bridge', role: 'contact', label: 'Bridge' },
    ],
    SWITCH,
    'WireFactory logical matrix; lug placement varies by product.',
    true,
    'selector-3way',
  ),
  make(
    'three-way-blade',
    '3-way blade switch',
    'Switches',
    'Two-pole blade selector with three positions.',
    'Traditional pickup selection.',
    twoPoleBlade,
    SWITCH,
  ),
  make(
    'five-way-blade',
    '5-way blade switch',
    'Switches',
    'Two-pole blade selector with five positions.',
    'Strat-style pickup combinations.',
    twoPoleBlade,
    SWITCH,
  ),
  make(
    'spst-on-off',
    'SPST on/off mini switch',
    'Switches',
    'One circuit that is either open or closed.',
    'Simple kill, bypass or add-pickup function.',
    contacts(['a', 'b']),
    SWITCH,
    'Generic logical contacts; verify physical lug orientation.',
    false,
    'unsupported',
    {
      defaultState: 'off',
      states: [
        { id: 'off', label: 'OFF', pairs: [] },
        { id: 'on', label: 'ON', pairs: [['a', 'b']] },
      ],
    },
  ),
  make(
    'spst-on-on',
    'SPST on/off switch (legacy ID)',
    'Switches',
    'Deprecated legacy identifier retained for existing project files.',
    'Simple kill, bypass or add-pickup function.',
    contacts(['a', 'b']),
    SWITCH,
    'Legacy generic on/off mapping; retained without identifier migration.',
    false,
    'unsupported',
    {
      defaultState: 'off',
      states: [
        { id: 'off', label: 'OFF', pairs: [] },
        { id: 'on', label: 'ON', pairs: [['a', 'b']] },
      ],
    },
  ),
  make(
    'spdt-on-on',
    'SPDT on/on switch',
    'Switches',
    'One common selects one of two throws.',
    'Choose between two signal sources.',
    contacts(['a', 'common', 'b']),
    SWITCH,
  ),
  make(
    'spdt-on-off-on',
    'SPDT on/off/on mini switch',
    'Switches',
    'One common selects either throw, with a centre-off state.',
    'Three-state pickup or bypass selection.',
    contacts(['a', 'common', 'b']),
    SWITCH,
    'Generic logical contacts; verify physical lug orientation.',
    false,
    'unsupported',
    {
      defaultState: 'off',
      states: [
        { id: 'on-a', label: 'A', pairs: [['common', 'a']] },
        { id: 'off', label: 'OFF', pairs: [] },
        { id: 'on-b', label: 'B', pairs: [['common', 'b']] },
      ],
    },
  ),
  make(
    'dpdt-on-on',
    'DPDT on/on switch',
    'Switches',
    'Two mechanically linked SPDT contact sets.',
    'Phase reversal or series/parallel switching.',
    dpdt,
    SWITCH,
  ),
  make(
    'dpdt-on-off-on',
    'DPDT on/off/on switch',
    'Switches',
    'Two poles with a centre-off position.',
    'Three-state coil selection; generic logical contact model.',
    dpdt,
    SWITCH,
  ),
  make(
    'dpdt-on-on-on',
    'DPDT on/on/on switch',
    'Switches',
    'Two poles and three connected positions.',
    'Three-mode coil switching.',
    dpdt,
    SWITCH,
  ),
  make(
    'push-pull-dpdt',
    'Push/pull DPDT potentiometer',
    'Switches',
    'A DPDT switch combined with a potentiometer.',
    'Add a coil split without another visible toggle.',
    [...pot, ...dpdt],
    SWITCH,
  ),
  make(
    'push-push-dpdt',
    'Push/push DPDT potentiometer',
    'Switches',
    'A latching DPDT switch combined with a potentiometer.',
    'Push-to-toggle phase or coil configuration.',
    [...pot, ...dpdt],
    SWITCH,
  ),
  make(
    'four-pole-five-throw',
    '4P5T superswitch',
    'Switches',
    'Four independent poles with five throws each.',
    'Complex five-position pickup routing.',
    superSwitch,
    SWITCH,
  ),
  make(
    'capacitor',
    'Capacitor',
    'Passive parts',
    'Reactive two-terminal component.',
    '22 nF or 47 nF tone capacitor.',
    [
      { id: 'a', role: 'component', label: 'A' },
      { id: 'b', role: 'component', label: 'B' },
    ],
    PICKUP,
    'V1 lists capacitance but does not simulate frequency response.',
    true,
    'capacitor',
  ),
  make(
    'resistor',
    'Resistor',
    'Passive parts',
    'Resistive two-terminal component.',
    'Fixed load or partial coil-split resistor.',
    [
      { id: 'a', role: 'component', label: 'A' },
      { id: 'b', role: 'component', label: 'B' },
    ],
  ),
  make(
    'treble-bleed',
    'Treble-bleed network',
    'Passive parts',
    'Capacitor or capacitor/resistor volume network.',
    'Retain more treble as volume is reduced.',
    [
      { id: 'a', role: 'component', label: 'Input side' },
      { id: 'b', role: 'component', label: 'Output side' },
    ],
  ),
  make(
    'mono-jack',
    'Mono output jack (TS)',
    'Outputs',
    'Two-pole tip/sleeve output connector.',
    'Standard passive-guitar output.',
    [
      { id: 'tip', role: 'tip', label: 'Tip / hot' },
      { id: 'sleeve', role: 'sleeve', label: 'Sleeve / ground' },
    ],
    JACK,
    'Terminal orientation varies; continuity-test the real jack.',
    true,
    'mono-jack',
  ),
  make(
    'stereo-jack',
    'Stereo output jack (TRS)',
    'Outputs',
    'Three-pole tip/ring/sleeve connector.',
    'Battery switching or stereo pickup outputs.',
    [
      { id: 'tip', role: 'tip', label: 'Tip' },
      { id: 'ring', role: 'signal', label: 'Ring' },
      { id: 'sleeve', role: 'sleeve', label: 'Sleeve' },
    ],
    JACK,
  ),
  make(
    'bridge-ground',
    'Bridge / string ground',
    'Grounding',
    'Ground bond to bridge or strings.',
    'Bond bridge hardware to circuit ground.',
    [{ id: 'ground', role: 'ground', label: 'Ground' }],
  ),
  make(
    'shield',
    'Cavity shield',
    'Grounding',
    'Conductive cavity or pickguard shield connection.',
    'Connect shielding to the circuit ground.',
    [{ id: 'ground', role: 'shield', label: 'Shield' }],
  ),
  make(
    'junction',
    'Ground junction',
    'Grounding',
    'Logical common connection point.',
    'Represent a common ground bus.',
    [{ id: 'node', role: 'ground', label: 'Node' }],
    JACK,
    'A schematic junction does not prescribe a physical ground layout.',
    true,
    'junction',
  ),
]

export const contactModels: Record<string, Definition['contactModel']> = {
  'spdt-on-on': {
    defaultState: 'on-a',
    states: [
      { id: 'on-a', label: 'A', pairs: [['common', 'a']] },
      { id: 'on-b', label: 'B', pairs: [['common', 'b']] },
    ],
  },
  'three-way-toggle': {
    defaultState: 'middle',
    states: [
      { id: 'neck', label: 'Neck', pairs: [['neck', 'common']] },
      {
        id: 'middle',
        label: 'Both',
        pairs: [
          ['neck', 'common'],
          ['bridge', 'common'],
        ],
      },
      { id: 'bridge', label: 'Bridge', pairs: [['bridge', 'common']] },
    ],
  },
  'three-way-blade': {
    defaultState: 'middle',
    states: [
      {
        id: 'neck',
        label: '1',
        pairs: [
          ['a0', 'a1'],
          ['b0', 'b1'],
        ],
      },
      {
        id: 'middle',
        label: '2',
        pairs: [
          ['a0', 'a2'],
          ['b0', 'b2'],
        ],
      },
      {
        id: 'bridge',
        label: '3',
        pairs: [
          ['a0', 'a3'],
          ['b0', 'b3'],
        ],
      },
    ],
  },
  'five-way-blade': {
    defaultState: 'three',
    states: [
      {
        id: 'one',
        label: '1',
        pairs: [
          ['a0', 'a1'],
          ['b0', 'b1'],
        ],
      },
      {
        id: 'two',
        label: '2',
        pairs: [
          ['a0', 'a1'],
          ['a0', 'a2'],
          ['b0', 'b1'],
          ['b0', 'b2'],
        ],
      },
      {
        id: 'three',
        label: '3',
        pairs: [
          ['a0', 'a2'],
          ['b0', 'b2'],
        ],
      },
      {
        id: 'four',
        label: '4',
        pairs: [
          ['a0', 'a2'],
          ['a0', 'a3'],
          ['b0', 'b2'],
          ['b0', 'b3'],
        ],
      },
      {
        id: 'five',
        label: '5',
        pairs: [
          ['a0', 'a3'],
          ['b0', 'b3'],
        ],
      },
    ],
  },
  'dpdt-on-on': {
    defaultState: 'on-a',
    states: [
      {
        id: 'on-a',
        label: 'A',
        pairs: [
          ['a2', 'a1'],
          ['b2', 'b1'],
        ],
      },
      {
        id: 'on-b',
        label: 'B',
        pairs: [
          ['a2', 'a3'],
          ['b2', 'b3'],
        ],
      },
    ],
  },
  'dpdt-on-off-on': {
    defaultState: 'off',
    states: [
      {
        id: 'on-a',
        label: 'A',
        pairs: [
          ['a2', 'a1'],
          ['b2', 'b1'],
        ],
      },
      { id: 'off', label: 'OFF', pairs: [] },
      {
        id: 'on-b',
        label: 'B',
        pairs: [
          ['a2', 'a3'],
          ['b2', 'b3'],
        ],
      },
    ],
  },
  'dpdt-on-on-on': {
    defaultState: 'center',
    states: [
      {
        id: 'on-a',
        label: 'A',
        pairs: [
          ['a2', 'a1'],
          ['b2', 'b1'],
        ],
      },
      {
        id: 'center',
        label: 'Centre',
        pairs: [
          ['a2', 'a1'],
          ['b2', 'b3'],
        ],
      },
      {
        id: 'on-b',
        label: 'B',
        pairs: [
          ['a2', 'a3'],
          ['b2', 'b3'],
        ],
      },
    ],
  },
  'push-pull-dpdt': {
    defaultState: 'full',
    states: [
      {
        id: 'full',
        label: 'A / down',
        pairs: [
          ['a2', 'a1'],
          ['b2', 'b1'],
        ],
      },
      {
        id: 'split',
        label: 'B / actuated',
        pairs: [
          ['a2', 'a3'],
          ['b2', 'b3'],
        ],
      },
    ],
  },
  'push-push-dpdt': {
    defaultState: 'full',
    states: [
      {
        id: 'full',
        label: 'A / down',
        pairs: [
          ['a2', 'a1'],
          ['b2', 'b1'],
        ],
      },
      {
        id: 'split',
        label: 'B / actuated',
        pairs: [
          ['a2', 'a3'],
          ['b2', 'b3'],
        ],
      },
    ],
  },
  'four-pole-five-throw': {
    defaultState: 'one',
    states: ['one', 'two', 'three', 'four', 'five'].map((id, index) => ({
      id,
      label: String(index + 1),
      pairs: ['a', 'b', 'c', 'd'].map(
        (pole) => [pole + 'c', pole + String(index + 1)] as [string, string],
      ),
    })),
  },
}
for (const entry of catalog) {
  if (contactModels[entry.id]) entry.contactModel = contactModels[entry.id]
}
for (const id of ['push-pull-dpdt', 'push-push-dpdt']) {
  const entry = catalog.find((item) => item.id === id)
  if (entry) entry.behavior = 'potentiometer'
}

export const definition = (id: string) => catalog.find((entry) => entry.id === id)
export const catalogCategories = Array.from(new Set(catalog.map((entry) => entry.category)))

const hb4 = catalog.find((item) => item.id === 'hb-4c-shield')!
hb4.coils = [
  { id: 'north', start: 'north-start', finish: 'north-finish' },
  { id: 'south', start: 'south-start', finish: 'south-finish' },
]

for (const id of ['push-pull-dpdt', 'push-push-dpdt']) {
  const part = catalog.find((item) => item.id === id)!
  part.source =
    id === 'push-pull-dpdt'
      ? 'Bourns PDB183-GTR (DPDT push-pull)'
      : 'Bourns PDB185-GTR (DPDT latching push)'
  part.sourceUrl =
    'https://www.bourns.com/docs/product-datasheets/' +
    (id === 'push-pull-dpdt' ? 'PDB183' : 'PDB185') +
    '-GTR.pdf'
  part.limitation =
    'Separate potentiometer and generic DPDT contacts. A/B do not specify the lug orientation of a physical part.'
}
catalog.find((item) => item.id === 'dpdt-on-on-on')!.limitation =
  'Generic type-A matrix: centre closes A2-A1 and B2-B3. Other manufacturers and variants differ; verify continuity.'

for (const part of catalog) if (part.category === 'Pickups') part.behavior = 'pickup'
// Structural analysis support: every catalogued control has the same finite pot-track model.
for (const part of catalog) if (part.category === 'Controls') part.behavior = 'potentiometer'

// Explicit runtime model coverage; absent models must never be silently verified.
for (const part of catalog) {
  if (part.category === 'Pickups') part.electricalModel = 'pickup'
  else if (part.behavior === 'potentiometer') part.electricalModel = 'potentiometer'
  else if (['capacitor', 'resistor', 'treble-bleed'].includes(part.id))
    part.electricalModel = 'passive'
  else if (['mono-jack', 'stereo-jack'].includes(part.id)) part.electricalModel = 'output'
  else if (['junction', 'bridge-ground', 'shield'].includes(part.id))
    part.electricalModel = 'ground'
  else if (part.contactModel) part.electricalModel = 'contacts'
}
