import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { definition } from './catalog'
import {
  CARD_WIDTH,
  componentHeight,
  diagramBounds,
  pointsAttribute,
  terminalPosition,
  wirePoints,
} from './layout'
import type { WireFactoryDocument } from './model'
import type { ResolvedCircuit } from './resolver'

const escapeXml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!,
  )

const valuesText = (values: Record<string, string>) =>
  Object.entries(values)
    .filter(([key]) => key !== 'control' && key !== 'position')
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ')

export function buildBomCsv(doc: WireFactoryDocument) {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
  return [
    ['Qty', 'Component', 'Definition', 'Values', 'Pinout'].map(quote).join(','),
    ...doc.instances.map((item) =>
      [
        '1',
        item.label,
        definition(item.definitionId)?.name ?? item.definitionId,
        valuesText(item.values),
        `${item.pinoutId} v${item.pinoutVersion}`,
      ]
        .map(quote)
        .join(','),
    ),
  ].join('\r\n')
}

export function buildSvg(doc: WireFactoryDocument, resolved: ResolvedCircuit): string {
  const bounds = diagramBounds(doc)
  const activeWireIds = new Set(resolved.activeWireIds)
  const activeTerminals = new Set(resolved.activeTerminals)
  const wires = doc.wires
    .map((wire) => {
      const points = wirePoints(doc, wire)
      const active = activeWireIds.has(wire.id)
      return `<polyline points="${pointsAttribute(points)}" fill="none" stroke="${escapeXml(wire.color)}" stroke-width="${active ? 6 : 3}" stroke-linecap="round" stroke-linejoin="round" opacity="${active ? 1 : 0.72}" data-wire="${escapeXml(wire.id)}" data-from="${escapeXml(wire.from)}" data-to="${escapeXml(wire.to)}"/>`
    })
    .join('')
  const components = doc.instances
    .map((item) => {
      const itemDefinition = definition(item.definitionId)
      const height = componentHeight(item)
      const terminals = (itemDefinition?.terminals ?? [])
        .map((terminal) => {
          const key = `${item.id}:${terminal.id}`
          const point = terminalPosition(doc, key)!
          const active = activeTerminals.has(key)
          return `<g><circle cx="${point.x}" cy="${point.y}" r="${active ? 7 : 5}" fill="${active ? '#f0b35a' : '#172337'}" stroke="${active ? '#ffe0a3' : '#9aa8b7'}" stroke-width="2" data-terminal="${escapeXml(key)}"/><text x="${point.x}" y="${point.y + 18}" text-anchor="middle" fill="#9aa8b7" font-family="monospace" font-size="8">${escapeXml(terminal.label)}</text></g>`
        })
        .join('')
      return `<g data-component="${escapeXml(item.id)}"><rect x="${item.x}" y="${item.y}" width="${CARD_WIDTH}" height="${height}" rx="8" fill="#0f1928" stroke="#536276"/><text x="${item.x + 12}" y="${item.y + 23}" fill="#f5f0e7" font-family="monospace" font-size="13" font-weight="bold">${escapeXml(item.label)}</text><text x="${item.x + 12}" y="${item.y + 43}" fill="#9aa8b7" font-family="monospace" font-size="9">${escapeXml(itemDefinition?.name ?? item.definitionId)}</text>${terminals}</g>`
    })
    .join('')
  const functionRows = resolved.functionTable
    .map(
      (row, index) =>
        `<text x="${bounds.width - 330}" y="${48 + index * 18}" fill="#d5dce5" font-family="monospace" font-size="11">${row.selector}: N ${row.neck ? 'ON' : 'OFF'} / B ${row.bridge ? 'ON' : 'OFF'}</text>`,
    )
    .join('')
  const status = resolved.buildReady
    ? 'BUILD READY - verified generic starter topology'
    : 'DRAFT / INVALID - EXPORT BLOCKED IN APP'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}" role="img" aria-label="${escapeXml(doc.title)} wiring diagram"><rect width="100%" height="100%" fill="#071019"/><defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="#253246" stroke-width="1" opacity=".5"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid)"/><text x="36" y="40" fill="#f0b35a" font-family="monospace" font-size="22" font-weight="bold">WIREFACTORY / ${escapeXml(doc.title)}</text><text x="36" y="64" fill="#d5dce5" font-family="monospace" font-size="12">${status}</text>${functionRows}<g aria-label="wires">${wires}</g><g aria-label="components">${components}</g><text x="36" y="${bounds.height - 28}" fill="#9aa8b7" font-family="monospace" font-size="10">Generic schematic pinouts only. Confirm manufacturer colours, lug orientation and continuity before soldering.</text></svg>`
}

const pdfColor = (hex: string) => {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '9aa8b7'
  return rgb(
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255,
  )
}

const ascii = (value: string) => value.replace(/[^\x20-\x7E]/g, '-')

export async function buildPdf(
  doc: WireFactoryDocument,
  resolved: ResolvedCircuit,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`WireFactory - ${doc.title}`)
  pdf.setSubject(
    resolved.buildReady
      ? 'Verified generic starter topology'
      : 'Draft or invalid WireFactory document',
  )
  const font = await pdf.embedFont(StandardFonts.Courier)
  const bold = await pdf.embedFont(StandardFonts.CourierBold)
  const page = pdf.addPage([842, 595])
  const bounds = diagramBounds(doc)
  const diagramTop = 515
  const diagramHeight = 390
  const scale = Math.min(760 / bounds.width, diagramHeight / bounds.height)
  const offsetX = 40
  const offsetY = diagramTop - bounds.height * scale
  const mapPoint = (point: { x: number; y: number }) => ({
    x: offsetX + point.x * scale,
    y: offsetY + (bounds.height - point.y) * scale,
  })
  page.drawText(`WIREFACTORY / ${ascii(doc.title)}`, {
    x: 40,
    y: 560,
    size: 17,
    font: bold,
    color: pdfColor('#c88a3d'),
  })
  page.drawText(
    resolved.buildReady
      ? 'BUILD READY - verified generic starter topology'
      : 'DRAFT / INVALID - NOT FOR PHYSICAL BUILD',
    { x: 40, y: 540, size: 9, font, color: pdfColor('#334155') },
  )
  const activeWireIds = new Set(resolved.activeWireIds)
  for (const wire of doc.wires) {
    const points = wirePoints(doc, wire).map(mapPoint)
    for (let index = 1; index < points.length; index += 1) {
      page.drawLine({
        start: points[index - 1],
        end: points[index],
        thickness: activeWireIds.has(wire.id) ? 2.5 : 1.2,
        color: pdfColor(wire.color),
        opacity: activeWireIds.has(wire.id) ? 1 : 0.72,
      })
    }
  }
  for (const item of doc.instances) {
    const bottomLeft = mapPoint({ x: item.x, y: item.y + componentHeight(item) })
    page.drawRectangle({
      x: bottomLeft.x,
      y: bottomLeft.y,
      width: CARD_WIDTH * scale,
      height: componentHeight(item) * scale,
      borderWidth: 0.8,
      borderColor: pdfColor('#536276'),
      color: pdfColor('#f4f0e9'),
    })
    page.drawText(ascii(item.label).slice(0, 26), {
      x: bottomLeft.x + 5,
      y: bottomLeft.y + componentHeight(item) * scale - 11,
      size: 6.8,
      font: bold,
      color: pdfColor('#111827'),
    })
    for (const terminal of definition(item.definitionId)?.terminals ?? []) {
      const point = mapPoint(terminalPosition(doc, `${item.id}:${terminal.id}`)!)
      page.drawCircle({
        x: point.x,
        y: point.y,
        size: 2.2,
        color: pdfColor('#334155'),
      })
    }
  }
  page.drawText('Selector function: neck=N / middle=N+B / bridge=B', {
    x: 40,
    y: 96,
    size: 8,
    font,
  })
  page.drawText('Generic schematic only. Verify maker pinouts and continuity before soldering.', {
    x: 40,
    y: 76,
    size: 7.5,
    font,
    color: pdfColor('#475569'),
  })

  const detail = pdf.addPage([842, 595])
  detail.drawText('BILL OF MATERIALS', { x: 40, y: 555, size: 14, font: bold })
  doc.instances.forEach((item, index) => {
    const values = valuesText(item.values)
    detail.drawText(
      ascii(
        `${index + 1}. ${item.label} | ${definition(item.definitionId)?.name ?? item.definitionId}${values ? ` | ${values}` : ''}`,
      ).slice(0, 112),
      { x: 40, y: 532 - index * 17, size: 7.5, font },
    )
  })
  detail.drawText('WIRE LIST', { x: 40, y: 355, size: 14, font: bold })
  doc.wires.forEach((wire, index) => {
    detail.drawText(ascii(`${wire.id}: ${wire.from} -> ${wire.to} [${wire.role}]`).slice(0, 112), {
      x: 40,
      y: 332 - index * 14,
      size: 7.2,
      font,
    })
  })
  detail.drawText(
    resolved.buildReady
      ? 'Validation: PASS for the exact WireFactory starter contract.'
      : `Validation: BLOCKED (${resolved.diagnostics.filter((entry) => entry.severity === 'error').length} errors).`,
    { x: 40, y: 72, size: 8, font: bold },
  )
  detail.drawText(
    'No frequency response, maker colour code or physical lug orientation is implied.',
    {
      x: 40,
      y: 54,
      size: 7.5,
      font,
    },
  )
  return pdf.save()
}
