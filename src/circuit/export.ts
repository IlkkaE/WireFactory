import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { definition } from './catalog'
import { componentGeometry, primitiveSvg, type Primitive } from './componentGeometry'
import { diagramBounds, pointsAttribute, wirePoints } from './layout'
import type { WireFactoryDocument } from './model'
import type { ResolvedCircuit } from './resolver'
const escapeXml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  )
const valuesText = (values: Record<string, string>) =>
  Object.entries(values)
    .filter(([key]) => key !== 'control' && key !== 'position')
    .map(([key, value]) => key + ': ' + value)
    .join(', ')
export function buildBomCsv(doc: WireFactoryDocument) {
  const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"'
  return [
    ['Qty', 'Component', 'Definition', 'Values', 'Pinout'].map(quote).join(','),
    ...doc.instances.map((item) =>
      [
        '1',
        item.label,
        definition(item.definitionId)?.name ?? item.definitionId,
        valuesText(item.values),
        item.pinoutId + ' v' + item.pinoutVersion,
      ]
        .map(quote)
        .join(','),
    ),
  ].join('\r\n')
}
const coilText = (resolved: ResolvedCircuit) =>
  resolved.paths
    .filter((p) => p.coilMode)
    .map(
      (p) =>
        p.pickup +
        ': ' +
        p.coilMode +
        ' (' +
        p.coilCount +
        ' coil' +
        (p.coilCount === 1 ? '' : 's') +
        ')',
    )
    .join(' / ')
export function buildSvg(doc: WireFactoryDocument, resolved: ResolvedCircuit): string {
  const bounds = diagramBounds(doc),
    active = new Set(resolved.activeWireIds)
  const wires = doc.wires
    .map(
      (wire) =>
        '<polyline points="' +
        pointsAttribute(wirePoints(doc, wire)) +
        '" fill="none" stroke="' +
        escapeXml(wire.color) +
        '" stroke-width="' +
        (active.has(wire.id) ? 5 : 2.5) +
        '" stroke-linecap="round" stroke-linejoin="round" data-wire="' +
        escapeXml(wire.id) +
        '" data-from="' +
        escapeXml(wire.from) +
        '" data-to="' +
        escapeXml(wire.to) +
        '"/>',
    )
    .join('')
  const components = doc.instances
    .map((item) => {
      const g = componentGeometry(item)
      return (
        '<g data-component="' +
        escapeXml(item.id) +
        '" data-definition="' +
        escapeXml(item.definitionId) +
        '" transform="translate(' +
        item.x +
        ' ' +
        item.y +
        ')">' +
        g.primitives.map(primitiveSvg).join('') +
        Object.entries(g.terminals)
          .map(
            ([id, p]) =>
              '<circle data-terminal="' +
              escapeXml(item.id + ':' + id) +
              '" cx="' +
              p.x +
              '" cy="' +
              p.y +
              '" r="6" fill="none" stroke="' +
              (resolved.activeTerminals.includes(item.id + ':' + id) ? '#ffbc58' : 'none') +
              '"/>',
          )
          .join('') +
        '<text x="' +
        g.width / 2 +
        '" y="13" text-anchor="middle" fill="#e2e8ec" font-family="monospace" font-size="9">' +
        escapeXml(item.label) +
        '</text></g>'
      )
    })
    .join('')
  const status = resolved.buildReady
    ? 'BUILD READY - structural analysis valid'
    : 'DRAFT / INVALID / UNSUPPORTED - EXPORT BLOCKED IN APP'
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    bounds.width +
    '" height="' +
    (bounds.height + 100) +
    '" viewBox="0 0 ' +
    bounds.width +
    ' ' +
    (bounds.height + 100) +
    '" role="img" aria-label="' +
    escapeXml(doc.title) +
    ' wiring diagram"><rect width="100%" height="100%" fill="#071019"/><text x="30" y="30" fill="#f0b35a" font-family="monospace" font-size="18">WIREFACTORY / ' +
    escapeXml(doc.title) +
    '</text><text x="30" y="53" fill="#d5dce5" font-family="monospace" font-size="11">' +
    escapeXml(status) +
    '</text><text x="30" y="75" fill="#d5dce5" font-family="monospace" font-size="11">' +
    escapeXml(coilText(resolved)) +
    '</text><g transform="translate(0 85)"><g aria-label="wires">' +
    wires +
    '</g><g aria-label="components">' +
    components +
    '</g></g><desc>' +
    escapeXml(
      JSON.stringify({
        outputs: resolved.outputObservations,
        pickups: resolved.paths.map((p) => ({
          id: p.pickup,
          label: doc.instances.find((i) => i.id === p.pickup)?.label,
          active: p.active,
          mode: p.coilMode,
          coils: p.coilCount,
        })),
      }),
    ) +
    '</desc><text x="30" y="' +
    (bounds.height + 85) +
    '" fill="#9aa8b7" font-family="monospace" font-size="9">Generic logical pinouts. Confirm manufacturer lug orientation and continuity before soldering.</text></svg>'
  )
}
const pdfColor = (hex: string) => {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '9aa8b7'
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  )
}
const ascii = (value: string) => value.replace(/[^\x20-\x7E]/g, '-')
export function drawPdfPrimitive(
  page: PDFPage,
  p: Primitive,
  origin: { x: number; y: number },
  scale: number,
  font: PDFFont,
) {
  if (p.type === 'text') {
    const text = ascii(p.text),
      size = p.size * scale
    page.drawText(text, {
      x: origin.x + p.x * scale - font.widthOfTextAtSize(text, size) / 2,
      y: origin.y - p.y * scale,
      size,
      font,
      color: pdfColor(p.fill),
    })
  } else if (p.type === 'ellipse')
    page.drawEllipse({
      x: origin.x + p.x * scale,
      y: origin.y - p.y * scale,
      xScale: p.rx * scale,
      yScale: p.ry * scale,
      color: p.fill ? pdfColor(p.fill) : undefined,
      borderColor: p.stroke ? pdfColor(p.stroke) : undefined,
      borderWidth: (p.strokeWidth ?? 1) * scale,
    })
  else
    page.drawSvgPath(p.d, {
      x: origin.x,
      y: origin.y,
      scale,
      color: p.fill ? pdfColor(p.fill) : undefined,
      borderColor: p.stroke ? pdfColor(p.stroke) : undefined,
      borderWidth: p.strokeWidth ?? 1,
    })
}
export async function buildPdf(
  doc: WireFactoryDocument,
  resolved: ResolvedCircuit,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle('WireFactory - ' + doc.title)
  pdf.setSubject(
    resolved.buildReady ? 'Structural analysis valid' : 'Draft or invalid WireFactory document',
  )
  const font = await pdf.embedFont(StandardFonts.Courier),
    bold = await pdf.embedFont(StandardFonts.CourierBold)
  const page = pdf.addPage([842, 595]),
    bounds = diagramBounds(doc)
  page.drawText(ascii('WIREFACTORY / ' + doc.title), {
    x: 40,
    y: 561,
    size: 12,
    font: bold,
    color: pdfColor('#956524'),
  })
  page.drawText(
    ascii(
      resolved.buildReady
        ? 'BUILD READY - structural analysis valid'
        : 'DRAFT / INVALID / UNSUPPORTED',
    ),
    { x: 40, y: 540, size: 9, font },
  )
  page.drawText(ascii(coilText(resolved)), { x: 40, y: 524, size: 8, font })
  const scale = Math.min(760 / bounds.width, 385 / bounds.height),
    origin = { x: 40 + (760 - bounds.width * scale) / 2, y: 510 }
  page.drawRectangle({ x: 40, y: 122, width: 760, height: 390, color: pdfColor('#071019') })
  const map = (p: { x: number; y: number }) => ({
    x: origin.x + p.x * scale,
    y: origin.y - p.y * scale,
  })
  for (const wire of doc.wires) {
    const points = wirePoints(doc, wire).map(map)
    for (let n = 1; n < points.length; n++)
      page.drawLine({
        start: points[n - 1],
        end: points[n],
        thickness: (resolved.activeWireIds.includes(wire.id) ? 5 : 2.5) * scale,
        color: pdfColor(wire.color),
      })
  }
  for (const item of doc.instances) {
    const g = componentGeometry(item),
      o = map(item)
    for (const p of g.primitives) drawPdfPrimitive(page, p, o, scale, font)
    drawPdfPrimitive(
      page,
      { type: 'text', x: g.width / 2, y: 13, text: item.label, size: 9, fill: '#e2e8ec' },
      o,
      scale,
      font,
    )
  }
  page.drawText(
    'Switch table uses nominal controls; live results reflect the checked control settings.',
    { x: 40, y: 100, size: 8, font },
  )
  page.drawText('Generic logical pinouts; verify manufacturer lug orientation and continuity.', {
    x: 40,
    y: 80,
    size: 8,
    font,
  })
  page.drawText('Display units only. No physical scale or audio frequency response is implied.', {
    x: 40,
    y: 63,
    size: 8,
    font,
  })
  let detail = pdf.addPage([842, 595]),
    y = 552
  const footer = (p: PDFPage) =>
    p.drawText('WireFactory / ' + ascii(doc.title).slice(0, 100), {
      x: 40,
      y: 30,
      size: 7,
      font,
      color: pdfColor('#64748b'),
    })
  const reserve = (space: number) => {
    if (y - space < 66) {
      footer(detail)
      detail = pdf.addPage([842, 595])
      y = 552
    }
  }
  const heading = (label: string) => {
    reserve(40)
    detail.drawText(label, { x: 40, y, size: 12, font: bold })
    y -= 24
  }
  const row = (label: string) => {
    const chunks = ascii(label).match(/.{1,116}/g) ?? ['']
    reserve(chunks.length * 12)
    for (const chunk of chunks) {
      detail.drawText(chunk, { x: 40, y, size: 7.5, font })
      y -= 12
    }
  }
  heading('CHECKED CIRCUIT STATE')
  for (const [id, output] of Object.entries(resolved.outputObservations))
    row(
      id +
        ' | ' +
        output.state.toUpperCase() +
        ' | ' +
        output.sources.map((s) => doc.instances.find((i) => i.id === s)?.label ?? s).join(' + '),
    )
  for (const path of resolved.paths)
    if (path.coilMode)
      row(
        (doc.instances.find((i) => i.id === path.pickup)?.label ?? path.pickup) +
          ' | ' +
          path.coilMode +
          ' | ' +
          path.coilCount +
          ' contributing coils',
      )
  row('Structural probes only. No audio level or frequency response prediction.')
  y -= 12
  heading('BILL OF MATERIALS')
  doc.instances.forEach((item, n) =>
    row(
      n +
        1 +
        '. ' +
        item.label +
        ' | ' +
        (definition(item.definitionId)?.name ?? item.definitionId) +
        ' | ' +
        valuesText(item.values) +
        (item.controlState ? ' | switch: ' + item.controlState : ''),
    ),
  )
  y -= 16
  heading('WIRE LIST')
  doc.wires.forEach((wire) =>
    row(wire.id + ': ' + wire.from + ' -> ' + wire.to + ' [' + wire.role + ']'),
  )
  y -= 12
  reserve(36)
  row(resolved.buildReady ? 'Validation: PASS for structural analysis.' : 'Validation: BLOCKED.')
  row('Confirm maker wire colours and lug orientation before physical assembly.')
  footer(detail)
  return pdf.save()
}
