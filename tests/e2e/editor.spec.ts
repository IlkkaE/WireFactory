import { expect, test, type Download } from '@playwright/test'

async function downloadText(download: Download) {
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

test('starter resolves, reacts to controls, edits and exports one snapshot', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  await page.goto('/wirefactory/')

  await expect(page.getByTestId('build-status')).toHaveText(/BUILD READY/)
  await expect(page.locator('[data-component-id]')).toHaveCount(9)
  await expect(page.locator('.wire[data-wire-id]')).toHaveCount(16)
  await expect(page.locator('.wire[data-wire-id="w01"]')).toHaveClass(/active/)
  await expect(page.locator('.wire[data-wire-id="w03"]')).toHaveClass(/active/)

  await page.getByLabel('Selector state', { exact: true }).selectOption('neck')
  await expect(page.locator('.wire[data-wire-id="w01"]')).toHaveClass(/active/)
  await expect(page.locator('.wire[data-wire-id="w03"]')).not.toHaveClass(/active/)
  await page.getByLabel('Neck volume', { exact: true }).selectOption('zero')
  await expect(page.getByText('OUTPUT MUTED')).toBeVisible()
  await page.getByLabel('Neck volume', { exact: true }).selectOption('full')

  const projectDownloadPromise = page.waitForEvent('download')
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
  await page.getByRole('button', { name: 'SVG' }).click()
  const svg = (await downloadText(await svgDownloadPromise)).toString('utf8')
  expect(svg).toContain('data-wire="w01"')
  expect(svg).toContain('data-component="neck-volume"')

  const pdfDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PDF' }).click()
  const pdf = await downloadText(await pdfDownloadPromise)
  expect(pdf.subarray(0, 4).toString('ascii')).toBe('%PDF')
  expect(pdf.length).toBeGreaterThan(2000)

  const bomDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'BOM' }).click()
  const bom = (await downloadText(await bomDownloadPromise)).toString('utf8')
  expect(bom).toContain('Neck volume')
  expect(bom).toContain('22nF')

  const neck = page.locator('[data-component-id="neck"]')
  const handle = neck.locator('.component-drag-handle')
  const before = await neck.boundingBox()
  const handleBox = await handle.boundingBox()
  if (!before || !handleBox) throw new Error('Neck component is not measurable.')
  await page.mouse.move(handleBox.x + 50, handleBox.y + 25)
  await page.mouse.down()
  await page.mouse.move(handleBox.x + 95, handleBox.y + 55, { steps: 4 })
  await page.mouse.up()
  const after = await neck.boundingBox()
  expect(after?.x).toBeGreaterThan(before.x + 25)
  await page.getByRole('button', { name: 'Undo' }).click()

  await page.getByLabel('Add Resistor').click()
  await expect(page.getByTestId('build-status')).toHaveText(/DRAFT/)
  const resistor = page.locator('[data-component-id^="resistor-"]')
  await expect(resistor).toHaveCount(1)
  await resistor.getByRole('button', { name: 'Resistor: A' }).click()
  await page.getByRole('button', { name: 'Common ground: Node' }).click()
  await expect(page.locator('.wire[data-wire-id]')).toHaveCount(17)
  await expect(page.getByRole('button', { name: 'SVG' })).toBeDisabled()
  await page.getByRole('button', { name: 'Undo' }).click()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByTestId('build-status')).toHaveText(/BUILD READY/)

  await page.locator('[data-component-id="neck"]').click()
  await page.getByRole('button', { name: 'Delete component' }).click()
  await expect(page.getByTestId('build-status')).toHaveText(/DRAFT/)
  await expect(page.getByRole('button', { name: 'PDF' })).toBeDisabled()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByTestId('build-status')).toHaveText(/BUILD READY/)
  expect(consoleErrors).toEqual([])
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
  await expect(page.getByLabel('Search components')).toBeVisible()
})
