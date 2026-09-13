import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { buildBomCsv, buildPdf, buildSvg } from './export'
import { resolve } from './resolver'
import { starterDocument } from './template'

describe('snapshot exports', () => {
  it('places every component and real wire endpoint in the SVG', () => {
    const document = starterDocument()
    const svg = buildSvg(document, resolve(document))
    expect(svg.match(/data-component=/g)).toHaveLength(document.instances.length)
    expect(svg.match(/data-wire=/g)).toHaveLength(document.wires.length)
    expect(svg).toContain('data-from="neck:hot"')
    expect(svg).toContain('data-to="neck-volume:in"')
    expect(svg).toContain('WIREFACTORY / 2HB / 2V / 1T starter')
    expect(svg).not.toContain('WIREFATORY')
  })

  it('builds a BOM from the same component snapshot', () => {
    const document = starterDocument()
    const csv = buildBomCsv(document)
    expect(csv.split('\r\n')).toHaveLength(document.instances.length + 1)
    expect(csv).toContain('Neck volume')
    expect(csv).toContain('500k')
    expect(csv).toContain('22nF')
  })

  it('builds a two-page PDF with diagram and detail metadata', async () => {
    const document = starterDocument()
    const bytes = await buildPdf(document, resolve(document))
    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getPageCount()).toBe(2)
    expect(pdf.getTitle()).toContain('WireFactory')
    expect(pdf.getSubject()).toContain('Verified generic starter topology')
  })
})
