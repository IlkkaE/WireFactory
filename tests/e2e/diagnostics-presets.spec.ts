import { expect, test, type Download } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import { starterDocument } from '../../src/circuit/template'
const bytes = async (download: Download) => {
  const chunks: Buffer[] = []
  for await (const chunk of await download.createReadStream()) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

test('all diagnostic findings highlight safely and navigate back on desktop and mobile', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  const doc = starterDocument()
  doc.expectation = null
  for (let i = 0; i < 10; i++)
    doc.instances.push({
      ...doc.instances[0],
      id: i === 0 ? 'odd:"pickup' : 'unused-' + i,
      definitionId: 'single-coil',
      pinoutId: 'single-coil-generic',
      values: {},
      label: 'Unconnected ' + i,
      x: 1000,
      y: 80 + i * 180,
    })
  await page.goto('/wirefactory/')
  await page.locator('input[type=file]').setInputFiles({
    name: 'diagnostics.wirefactory',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(doc)),
  })
  await page.getByRole('button', { name: 'Check wiring', exact: true }).click()
  await expect(page.locator('.diagnostic')).toHaveCount(10)
  const entry = page.locator('.diagnostic').filter({ hasText: 'Unconnected 0' })
  const button = entry.locator('.diagnostic-select')
  await button.focus()
  await page.keyboard.press('Enter')
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  await expect(entry).toContainText('Suggested next step')
  await expect(page.locator('.component.diagnostic-target')).toHaveAttribute(
    'data-component-id',
    'odd:"pickup',
  )
  await expect(page.locator('.terminal.diagnostic-target')).toHaveCount(2)
  await entry.getByRole('button', { name: 'Show in diagram' }).click()
  await expect(page.locator('.terminal.diagnostic-target').first()).toBeInViewport()
  const back = page.getByRole('button', { name: 'Back to diagnostic' })
  await expect(back).toBeInViewport()
  await mkdir('output/diagnostics-presets/browser', { recursive: true })
  await page.screenshot({
    path: `output/diagnostics-presets/browser/${info.project.name}-highlight.jpg`,
    type: 'jpeg',
    quality: 70,
  })
  await back.click()
  await expect(button).toBeFocused()
  await entry.getByRole('button', { name: 'Show in diagram' }).click()
  await page.getByRole('button', { name: 'Clear highlight' }).click()
  await expect(page.locator('.diagnostic-target')).toHaveCount(0)
  await button.click()
  await page.getByLabel('Neck volume', { exact: true }).selectOption('zero')
  await expect(page.locator('.diagnostic-target')).toHaveCount(0)
  await expect(page.getByTestId('build-status')).toContainText('NOT CHECKED')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test('new presets load, switch, save/open and export checked artifacts', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await page.goto('/wirefactory/')
  for (const [preset, rows, component, state] of [
    ['fiveway', 5, 'selector', 'two'],
    ['seriesparallel', 2, 'series-parallel', 'on-b'],
  ] as const) {
    await page.getByLabel('Preset', { exact: true }).selectOption(preset)
    await page.getByRole('button', { name: 'Load preset', exact: true }).click()
    await expect(page.getByTestId('build-status')).toContainText('NOT CHECKED')
    await page.getByRole('button', { name: 'Check wiring', exact: true }).click()
    await expect(page.getByTestId('build-status')).toContainText('BUILD READY')
    await expect(page.locator('.function-section tbody tr')).toHaveCount(rows)
    await page.locator(`[data-component-id="${component}"] .component-drag-handle`).click()
    if (preset === 'seriesparallel')
      await expect(page.getByLabel('Switch state', { exact: true }).locator('option')).toHaveText([
        'Parallel (A)',
        'Series (B)',
      ])
    await page.getByLabel('Switch state', { exact: true }).selectOption(state)
    await expect(page.getByTestId('build-status')).toContainText('NOT CHECKED')
    await page.getByRole('button', { name: 'Check wiring', exact: true }).click()
    await expect(page.getByTestId('build-status')).toContainText('BUILD READY')
    await page.getByRole('button', { name: 'File...', exact: true }).click()
    let pending = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Save project', exact: true }).click()
    const saved = await bytes(await pending),
      parsed = JSON.parse(saved.toString())
    expect(parsed.expectation).toBeNull()
    expect(parsed.version).toBe(1)
    expect(parsed.instances.find((i: { id: string }) => i.id === component).controlState).toBe(
      state,
    )
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'saved.wirefactory', mimeType: 'application/json', buffer: saved })
    await expect(page.getByTestId('build-status')).toContainText('NOT CHECKED')
    await page.getByRole('button', { name: 'Check wiring', exact: true }).click()
    await expect(page.locator('.live-result')).toContainText('Neck single-coil')
    if (preset === 'fiveway')
      await expect(page.locator('.live-result')).toContainText('Middle single-coil')
    await mkdir('output/diagnostics-presets/browser', { recursive: true })
    await page.screenshot({
      path: `output/diagnostics-presets/browser/${info.project.name}-${preset}.jpg`,
      type: 'jpeg',
      quality: 70,
      fullPage: true,
    })
    for (const kind of ['SVG', 'PDF', 'BOM']) {
      await page.getByRole('button', { name: 'File...', exact: true }).click()
      pending = page.waitForEvent('download')
      await page.getByRole('button', { name: kind, exact: true }).click()
      const download = await pending
      const content = await bytes(download)
      await download.saveAs(
        `output/diagnostics-presets/browser/${info.project.name}-${preset}.${kind === 'BOM' ? 'csv' : kind.toLowerCase()}`,
      )
      if (kind === 'SVG') {
        expect(content.toString()).toContain('<svg')
        expect(content.toString()).toContain('Master volume')
      }
      if (kind === 'BOM') {
        expect(content.toString()).toContain('250k')
        expect(content.toString()).toContain('single-coil')
      }
      if (kind === 'PDF') {
        const pdf = await PDFDocument.load(content)
        expect(pdf.getPageCount()).toBeGreaterThan(0)
        for (const p of pdf.getPages()) {
          expect(p.getWidth()).toBe(842)
          expect(p.getHeight()).toBe(595)
        }
      }
    }
  }
  expect(errors).toEqual([])
})
