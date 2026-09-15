import { expect, test } from '@playwright/test'

test('runs analysis only when requested and preserves it across layout moves', async ({ page }) => {
  await page.goto('/wirefactory/')
  await expect(page.getByTestId('build-status')).toHaveText(/NOT CHECKED/)
  await page.getByRole('button', { name: 'Check wiring' }).click()
  await expect(page.getByTestId('build-status')).toHaveText(/BUILD READY/)

  const neck = page.locator('[data-component-id="neck"]')
  const handle = neck.locator('.component-drag-handle')
  const before = await neck.boundingBox()
  const box = await handle.boundingBox()
  if (!before || !box) throw new Error('No draggable starter pickup.')
  await page.mouse.move(box.x + 20, box.y + 10)
  await page.mouse.down()
  await page.mouse.move(box.x + 55, box.y + 30)
  await page.mouse.up()
  await expect(page.getByTestId('build-status')).toHaveText(/BUILD READY/)

  await page.getByLabel('Selector state', { exact: true }).selectOption('neck')
  await expect(page.getByTestId('build-status')).toHaveText(/NOT CHECKED/)
  await page.getByRole('button', { name: 'File...', exact: true }).click()
  await expect(page.getByRole('button', { name: 'SVG', exact: true })).toBeDisabled()
})
