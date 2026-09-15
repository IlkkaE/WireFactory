import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { type Instance, type WireFactoryDocument } from '../../src/circuit/model'
const part = (id: string, definitionId: string, x: number, y: number): Instance => ({
  id,
  definitionId,
  definitionVersion: 1,
  pinoutId: definitionId + '-generic',
  pinoutVersion: 1,
  label: id,
  values: {},
  x,
  y,
  rotation: 0,
})
test('custom three-source circuit checks, invalidates and downloads the checked snapshot', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  const fixture: WireFactoryDocument = {
    format: 'wirefactory-project',
    version: 1,
    title: 'Custom 3S',
    expectation: null,
    junctions: [],
    instances: [
      part('Alpha', 'single-coil', 30, 30),
      part('Beta', 'p90', 30, 240),
      part('Gamma', 'single-coil', 30, 450),
      part('Route', 'five-way-blade', 280, 200),
      part('Output', 'mono-jack', 580, 200),
    ],
    wires: [
      'Alpha:hot Route:a1',
      'Beta:hot Route:a2',
      'Gamma:hot Route:a3',
      'Route:a0 Output:tip',
      'Alpha:ground Output:sleeve',
      'Beta:ground Output:sleeve',
      'Gamma:ground Output:sleeve',
    ].map((edge, i) => {
      const [from, to] = edge.split(' ')
      return { id: 'w' + i, from, to, role: 'signal', color: '#f0b35a', label: '', waypoints: [] }
    }),
  }
  await page.goto('/wirefactory/')
  await page.locator('input[type=file]').setInputFiles({
    name: 'custom.wirefactory',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture)),
  })
  await expect(page.getByTestId('build-status')).toContainText('NOT CHECKED')
  await expect(page.locator('.function-section')).toHaveCount(0)
  await expect(page.getByLabel('Selector state', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Check wiring' }).click()
  await expect(page.getByTestId('build-status')).toContainText('BUILD READY')
  await expect(page.locator('.function-section tbody tr')).toHaveCount(5)
  await expect(page.locator('.function-section tr.current')).toHaveCount(1)
  await expect(page.locator('.live-result')).toHaveText('Beta')
  await page.locator('[data-component-id="Route"] .component-drag-handle').click()
  await page.getByLabel('Switch state', { exact: true }).selectOption('two')
  await expect(page.getByTestId('build-status')).toContainText('CHANGES NOT CHECKED')
  await expect(page.locator('.function-section')).toHaveCount(0)
  await expect(page.locator('.wire.active')).toHaveCount(0)
  await page.getByRole('button', { name: 'Check wiring' }).click()
  await expect(page.locator('.live-result')).toHaveText('Alpha + Beta')
  const target = path.join('output', 'browser-artifacts', info.project.name)
  await mkdir(target, { recursive: true })
  await page.screenshot({ path: path.join(target, 'custom.png'), fullPage: true })
  for (const kind of ['SVG', 'PDF', 'BOM']) {
    await page.getByRole('button', { name: 'File...', exact: true }).click()
    const pending = page.waitForEvent('download')
    await page.getByRole('button', { name: kind, exact: true }).click()
    const download = await pending
    await download.saveAs(path.join(target, download.suggestedFilename()))
  }
  await page.locator('input[type=file]').setInputFiles({
    name: 'unknown.wirefactory',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        ...fixture,
        instances: [
          ...fixture.instances,
          ...Array.from({ length: 10 }, (_, i) => part('Limit' + i, 'spst-on-off', 400, 400)),
        ],
      }),
    ),
  })
  await page.getByRole('button', { name: 'Check wiring' }).click()
  await expect(page.getByTestId('build-status')).toContainText('UNKNOWN')
  await page.getByRole('button', { name: 'File...', exact: true }).click()
  for (const kind of ['SVG', 'PDF', 'BOM'])
    await expect(page.getByRole('button', { name: kind, exact: true })).toBeDisabled()
  expect(errors).toEqual([])
})
