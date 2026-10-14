import { expect, test, type Download, type Page } from '@playwright/test'
import { catalog } from '../../src/circuit/catalog'

async function openFileMenu(page: Page) {
  const trigger = page.getByRole('button', { name: 'File...', exact: true })
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click()
}

async function downloadText(download: Download) {
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

async function clickWire(page: Page, id: string) {
  const scroll = page.getByTestId('canvas-scroll')
  await scroll.scrollIntoViewIfNeeded()
  const point = await page.locator('.wire[data-wire-id="' + id + '"]').evaluate((element) => {
    const line = element as SVGPolylineElement
    const hit = line.parentElement!.querySelector('.wire-hit')!
    const scroller = document.querySelector('[data-testid=canvas-scroll]')!
    const svg = line.ownerSVGElement!
    for (let n = 1; n < line.points.numberOfItems; n++) {
      const a = line.points.getItem(n - 1),
        b = line.points.getItem(n)
      for (const ratio of [0.5, 0.25, 0.75]) {
        const x = a.x + (b.x - a.x) * ratio,
          y = a.y + (b.y - a.y) * ratio
        scroller.scrollLeft = Math.max(0, x - scroller.clientWidth / 2)
        scroller.scrollTop = Math.max(0, y - scroller.clientHeight / 2)
        const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()!)
        if (document.elementFromPoint(p.x, p.y) === hit) return { x: p.x, y: p.y }
      }
    }
    return null
  })
  if (!point) throw new Error('No visible clickable segment for wire ' + id)
  await page.mouse.click(point.x, point.y)
  await expect(page.locator('.wire[data-wire-id="' + id + '"]')).toHaveClass(/selected/)
}

test('starter resolves, reacts to controls, edits and exports one snapshot', async ({ page }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  await page.goto('/wirefactory/')

  await page.getByRole('button', { name: 'Check wiring' }).click()
  await expect(page.getByTestId('build-status')).toHaveText(/BUILD READY/)
  await expect(page.locator('[data-component-id]')).toHaveCount(9)
  await expect(page.locator('.wire[data-wire-id]')).toHaveCount(16)
  await expect(page.locator('.wire[data-wire-id="w01"]')).toHaveClass(/active/)
  await expect(page.locator('.wire[data-wire-id="w03"]')).toHaveClass(/active/)

  await page.getByLabel('Selector state', { exact: true }).selectOption('neck')
  await page.getByRole('button', { name: 'Check wiring' }).click()
  await expect(page.locator('.wire[data-wire-id="w01"]')).toHaveClass(/active/)
  await expect(page.locator('.wire[data-wire-id="w03"]')).not.toHaveClass(/active/)
  await page.getByLabel('Neck volume', { exact: true }).selectOption('zero')
  await page.getByRole('button', { name: 'Check wiring' }).click()
  await expect(page.getByText('OUTPUT MUTED')).toBeVisible()
  await page.getByLabel('Neck volume', { exact: true }).selectOption('full')
  await page.getByRole('button', { name: 'Check wiring' }).click()

  const projectDownloadPromise = page.waitForEvent('download')
  await openFileMenu(page)
  await page.getByRole('button', { name: 'Save project' }).click()
  const projectBytes = await downloadText(await projectDownloadPromise)
  const project = JSON.parse(projectBytes.toString('utf8')) as {
    format: string
    version: number
    instances: unknown[]
    wires: unknown[]
  }
  expect(project).toMatchObject({ format: 'wirefactory-project', version: 1 })
  expect(project.instances).toHaveLength(9)
  expect(project.wires).toHaveLength(16)

  const svgDownloadPromise = page.waitForEvent('download')
  await openFileMenu(page)
  await page.getByRole('button', { name: 'SVG' }).click()
  const svg = (await downloadText(await svgDownloadPromise)).toString('utf8')
  expect(svg).toContain('data-wire="w01"')
  expect(svg).toContain('data-component="neck-volume"')

  const pdfDownloadPromise = page.waitForEvent('download')
  await openFileMenu(page)
  await page.getByRole('button', { name: 'PDF' }).click()
  const pdf = await downloadText(await pdfDownloadPromise)
  expect(pdf.subarray(0, 4).toString('ascii')).toBe('%PDF')
  expect(pdf.length).toBeGreaterThan(2000)

  const bomDownloadPromise = page.waitForEvent('download')
  await openFileMenu(page)
  await page.getByRole('button', { name: 'BOM' }).click()
  const bom = (await downloadText(await bomDownloadPromise)).toString('utf8')
  expect(bom).toContain('Neck volume')
  expect(bom).toContain('22nF')

  const neck = page.locator('[data-component-id="neck"]')
  const handle = neck.locator('.component-drag-handle')
  const before = await neck.boundingBox()
  const handleBox = await handle.boundingBox()
  if (!before || !handleBox) throw new Error('Neck component is not measurable.')
  await page.mouse.move(handleBox.x + 50, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(handleBox.x + 95, handleBox.y + 55, { steps: 4 })
  await page.mouse.up()
  const after = await neck.boundingBox()
  expect(after?.x).toBeGreaterThan(before.x + 25)
  await page.getByRole('button', { name: 'Undo' }).click()

  await page
    .getByLabel('Component group', { exact: true })
    .selectOption(catalog.find((item) => item.id === 'resistor')!.category)
  await page.getByLabel('Component type', { exact: true }).selectOption('resistor')
  await page.getByRole('button', { name: 'Add component', exact: true }).click()
  await expect(page.getByTestId('build-status')).toHaveText(/NOT CHECKED/)
  const resistor = page.locator('[data-component-id^="resistor-"]')
  await expect(resistor).toHaveCount(1)
  await resistor.getByRole('button', { name: 'Resistor: A' }).click()
  await page.getByRole('button', { name: 'Common ground: Node' }).click()
  await expect(page.locator('.wire[data-wire-id]')).toHaveCount(17)
  await openFileMenu(page)
  await expect(page.getByRole('button', { name: 'SVG' })).toBeDisabled()
  await page.getByRole('button', { name: 'File...', exact: true }).click()
  await page.getByRole('button', { name: 'Undo' }).click()
  await page.getByRole('button', { name: 'Undo' }).click()
  await page.getByRole('button', { name: 'Check wiring' }).click()
  await expect(page.getByTestId('build-status')).toHaveText(/BUILD READY/)

  await page.locator('[data-component-id="neck"]').click()
  await page.getByRole('button', { name: 'Delete component' }).click()
  await expect(page.getByTestId('build-status')).toHaveText(/NOT CHECKED/)
  await openFileMenu(page)
  await expect(page.getByRole('button', { name: 'PDF' })).toBeDisabled()
  await page.getByRole('button', { name: 'File...', exact: true }).click()
  await page.getByRole('button', { name: 'Undo' }).click()
  await page.getByRole('button', { name: 'Check wiring' }).click()
  await expect(page.getByTestId('build-status')).toHaveText(/BUILD READY/)
  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})

test('responsive layout contains the wide board in its own scroller', async ({
  page,
}, testInfo) => {
  await page.goto('/wirefactory/')
  const pageMetrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }))
  expect(pageMetrics.documentWidth).toBeLessThanOrEqual(pageMetrics.viewport)
  const canvasMetrics = await page.getByTestId('canvas-scroll').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  if (testInfo.project.name === 'mobile-edge') {
    expect(canvasMetrics.scrollWidth).toBeGreaterThan(canvasMetrics.clientWidth)
  }
  await expect(page.getByLabel('Selector state', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Component group')).toBeVisible()
  await expect(page.getByLabel('Component type')).toBeVisible()
})

test('master-volume topology saves, opens, blocks invalid export, and preserves state on invalid open', async ({
  page,
}) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/wirefactory/')
  await page.getByLabel('Preset').selectOption('master')
  await page.getByRole('button', { name: 'Load preset' }).click()
  await page.getByRole('button', { name: 'Check wiring' }).click()
  await expect(page.getByTestId('build-status')).toHaveText(/BUILD READY/)
  await expect(page.locator('[data-component-id]')).toHaveCount(8)
  await expect(page.getByLabel('Master volume', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Neck volume', { exact: true })).toHaveCount(0)
  await page.getByLabel('Master volume', { exact: true }).selectOption('zero')
  await page.getByRole('button', { name: 'Check wiring' }).click()
  await expect(page.getByText('OUTPUT MUTED')).toBeVisible()
  await page.getByLabel('Master volume', { exact: true }).selectOption('full')
  await page.getByRole('button', { name: 'Check wiring' }).click()

  await clickWire(page, 'w04')
  await expect(page.getByRole('button', { name: 'Delete wire' })).toBeVisible()
  await page.getByRole('button', { name: 'Delete wire' }).click()
  await expect(page.locator('[data-component-id]')).toHaveCount(8)
  await expect(page.getByTestId('build-status')).toHaveText(/NOT CHECKED/)
  await openFileMenu(page)
  await expect(page.getByRole('button', { name: 'SVG' })).toBeDisabled()
  await page.getByRole('button', { name: 'File...', exact: true }).click()
  await page.getByRole('button', { name: 'Master volume: Wiper' }).click()
  await page.getByRole('button', { name: 'Mono output jack: Tip / hot' }).click()
  await expect(page.locator('[data-component-id]')).toHaveCount(8)
  await page.getByRole('button', { name: 'Check wiring' }).click()
  await expect(page.getByTestId('build-status')).toHaveText(/BUILD READY/)

  const save = page.waitForEvent('download')
  await openFileMenu(page)
  await page.getByRole('button', { name: 'Save project' }).click()
  const saved = await downloadText(await save)
  const project = JSON.parse(saved.toString('utf8')) as {
    expectation: { id: string }
    instances: unknown[]
    wires: unknown[]
  }
  expect(project.expectation.id).toBe('2hb-1v-1t')
  expect(project.instances).toHaveLength(8)
  expect(project.wires).toHaveLength(14)

  await page.getByLabel('Preset').selectOption('starter')
  await page.getByRole('button', { name: 'Load preset' }).click()
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'master.wirefactory', mimeType: 'application/json', buffer: saved })
  await page.getByRole('button', { name: 'Check wiring' }).click()
  await expect(page.getByTestId('build-status')).toHaveText(/BUILD READY/)
  await expect(page.getByLabel('Master volume', { exact: true })).toBeVisible()
  await page.locator('input[type=file]').setInputFiles({
    name: 'invalid.wirefactory',
    mimeType: 'application/json',
    buffer: Buffer.from('{bad'),
  })
  await expect(page.getByText('Project file is not valid JSON.')).toBeVisible()
  await expect(page.getByLabel('Master volume', { exact: true })).toBeVisible()

  const svgDownload = page.waitForEvent('download')
  await openFileMenu(page)
  await page.getByRole('button', { name: 'SVG' }).click()
  const svg = (await downloadText(await svgDownload)).toString('utf8')
  expect(svg).toContain('BUILD READY - structural analysis valid')
  const pdfDownload = page.waitForEvent('download')
  await openFileMenu(page)
  await page.getByRole('button', { name: 'PDF' }).click()
  expect((await downloadText(await pdfDownload)).subarray(0, 4).toString('ascii')).toBe('%PDF')
  const bomDownload = page.waitForEvent('download')
  await openFileMenu(page)
  await page.getByRole('button', { name: 'BOM' }).click()
  expect((await downloadText(await bomDownload)).toString('utf8')).toContain('Master volume')
  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})

for (const variant of ['push-pull', 'push-push']) {
  test(
    'dual split ' + variant + ' switches, persists, edits and exports shared artwork',
    async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text())
      })
      await page.goto('/wirefactory/')
      await page.getByLabel('Preset').selectOption(variant === 'push-pull' ? 'pull' : 'push')
      await page.getByRole('button', { name: 'Load preset' }).click()
      await page.getByRole('button', { name: 'Check wiring' }).click()
      await expect(page.getByTestId('build-status')).toHaveText(/BUILD READY/)
      await expect(page.getByTestId('coil-result')).toHaveText(/2 COILS.*2 COILS/)
      const brand = await page.locator('.brand-block').boundingBox(),
        status = await page.getByTestId('build-status').boundingBox()
      if (!brand || !status) throw new Error('Header is not measurable')
      expect(
        brand.x + brand.width <= status.x ||
          status.x + status.width <= brand.x ||
          brand.y + brand.height <= status.y ||
          status.y + status.height <= brand.y,
      ).toBe(true)
      await page.getByLabel('Dual split', { exact: true }).selectOption('split')
      await page.getByRole('button', { name: 'Check wiring' }).click()
      await expect(page.getByTestId('coil-result')).toHaveText(/1 COIL.*1 COIL/)
      await page.getByRole('button', { name: 'Undo', exact: true }).click()
      await expect(page.getByLabel('Dual split', { exact: true })).toHaveValue('full')
      await page.getByRole('button', { name: 'Redo', exact: true }).click()
      await expect(page.getByLabel('Dual split', { exact: true })).toHaveValue('split')
      await page.getByLabel('Selector state', { exact: true }).selectOption('neck')
      await page.getByRole('button', { name: 'Check wiring' }).click()
      await page.getByRole('button', { name: 'Check wiring' }).click()
      await expect(page.getByTestId('build-status')).toHaveText(/BUILD READY/)
      await page.getByLabel('Master volume', { exact: true }).selectOption('zero')
      await page.getByRole('button', { name: 'Check wiring' }).click()
      await expect(page.getByText('OUTPUT MUTED')).toBeVisible()
      await page.getByLabel('Master volume', { exact: true }).selectOption('full')
      await page.getByRole('button', { name: 'Check wiring' }).click()
      const save = page.waitForEvent('download')
      await openFileMenu(page)
      await page.getByRole('button', { name: 'Save project' }).click()
      const saved = await downloadText(await save)
      await clickWire(page, 'w19')
      await page.getByRole('button', { name: 'Delete wire' }).click()
      await expect(page.getByTestId('build-status')).toHaveText(/NOT CHECKED/)
      await openFileMenu(page)
      await expect(page.getByRole('button', { name: 'SVG', exact: true })).toBeDisabled()
      await page.getByRole('button', { name: 'File...', exact: true }).click()
      await page.getByRole('button', { name: 'Undo', exact: true }).click()
      await page.getByRole('button', { name: 'Check wiring' }).click()
      await expect(page.getByTestId('build-status')).toHaveText(/BUILD READY/)
      await page.getByLabel('Preset', { exact: true }).selectOption('starter')
      await page.getByRole('button', { name: 'Load preset', exact: true }).click()
      await page
        .locator('input[type=file]')
        .setInputFiles({ name: 'split.wirefactory', mimeType: 'application/json', buffer: saved })
      await expect(page.getByLabel('Dual split', { exact: true })).toHaveValue('split')
      await expect(page.getByLabel('Selector state', { exact: true })).toHaveValue('neck')
      await page.getByRole('button', { name: 'Check wiring' }).click()
      await expect(page.getByTestId('build-status')).toHaveText(/BUILD READY/)
      for (const format of ['SVG', 'PDF', 'BOM']) {
        const promise = page.waitForEvent('download')
        await openFileMenu(page)
        await page.getByRole('button', { name: format, exact: true }).click()
        const bytes = await downloadText(await promise)
        if (format === 'SVG') {
          expect(bytes.toString()).toContain('data-definition="' + variant + '-dpdt"')
          expect(bytes.toString()).toContain('neck: split (1 coil)')
        }
        if (format === 'PDF') expect(bytes.subarray(0, 4).toString()).toBe('%PDF')
        if (format === 'BOM') expect(bytes.toString()).toContain(variant + '-dpdt')
      }
      expect(errors).toEqual([])
    },
  )
}

test('component dropdowns expose all 32 parts and only Add edits the board', async ({ page }) => {
  await page.goto('/wirefactory/')
  const group = page.getByLabel('Component group', { exact: true })
  const type = page.getByLabel('Component type', { exact: true })
  const parts = catalog.filter((item) => item.id !== 'spst-on-on')
  expect(parts).toHaveLength(32)
  await expect(page.getByLabel('Search components')).toHaveCount(0)
  const seen: string[] = []
  for (const category of [...new Set(parts.map((item) => item.category))]) {
    await group.selectOption(category)
    const expected = parts.filter((item) => item.category === category)
    await expect(type).toHaveValue(expected[0].id)
    expect(
      await type
        .locator('option')
        .evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value)),
    ).toEqual(expected.map((item) => item.id))
    for (const part of expected) {
      await type.selectOption(part.id)
      await expect(page.locator('[data-component-id]')).toHaveCount(9)
      await page.getByRole('button', { name: 'Add component', exact: true }).click()
      await expect(page.locator('[data-component-id]')).toHaveCount(10)
      await page.getByRole('button', { name: 'Undo', exact: true }).click()
      await expect(page.locator('[data-component-id]')).toHaveCount(9)
      seen.push(part.id)
    }
  }
  expect(new Set(seen).size).toBe(32)
})

test('preset selection waits for Load and supports reloading the same preset', async ({ page }) => {
  await page.goto('/wirefactory/')
  const preset = page.getByLabel('Preset', { exact: true })
  await expect(preset.locator('option')).toHaveCount(9)
  await preset.selectOption('pull')
  await expect(page.locator('[data-component-id]')).toHaveCount(9)
  await page.getByRole('button', { name: 'Load preset', exact: true }).click()
  await expect(page.locator('[data-component-id]')).toHaveCount(8)
  await page.getByLabel('Dual split', { exact: true }).selectOption('split')
  await page.getByRole('button', { name: 'Check wiring' }).click()
  await page.getByRole('button', { name: 'Load preset', exact: true }).click()
  await expect(page.getByLabel('Dual split', { exact: true })).toHaveValue('full')
  await expect(page.locator('.wire[data-wire-id]')).toHaveCount(20)
})

test('File disclosure supports keyboard, outside close, safe controls and actual Open', async ({
  page,
}) => {
  await page.goto('/wirefactory/')
  const trigger = page.getByRole('button', { name: 'File...', exact: true })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toBeFocused()
  await openFileMenu(page)
  await page.getByLabel('Component group', { exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await page.locator('[data-component-id="neck"]').click()
  for (const field of ['Component group', 'Component type', 'Preset']) {
    await page.getByLabel(field, { exact: true }).focus()
    await page.keyboard.press('Delete')
    await page.keyboard.press('Backspace')
    await expect(page.locator('[data-component-id]')).toHaveCount(9)
  }
  await openFileMenu(page)
  await page.getByRole('button', { name: 'Save project', exact: true }).focus()
  await page.keyboard.press('Delete')
  await expect(page.locator('[data-component-id]')).toHaveCount(9)
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  const chooser = await chooserPromise
  await chooser.setFiles({
    name: 'broken.wirefactory',
    mimeType: 'application/json',
    buffer: Buffer.from('{bad'),
  })
  await expect(page.getByText('Project file is not valid JSON.')).toBeVisible()
  await expect(page.locator('[data-component-id]')).toHaveCount(9)
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
})
