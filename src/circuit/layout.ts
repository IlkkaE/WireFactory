import { componentHeight, componentWidth, terminalPosition } from './componentGeometry'
import { splitTerminalKey, type Wire, type WireFactoryDocument } from './model'
import { definition } from './catalog'

export const CARD_WIDTH = 190
export const TERMINALS_PER_ROW = 4

export { componentHeight, componentWidth, terminalPosition } from './componentGeometry'

export const wirePoints = (doc: WireFactoryDocument, wire: Wire) => {
  const start = terminalPosition(doc, wire.from)
  const end = terminalPosition(doc, wire.to)
  if (!start || !end) return []
  if (wire.waypoints.length) return [start, ...wire.waypoints, end]
  const escape = (key: string, point: { x: number; y: number }) => {
    const [id, pin] = splitTerminalKey(key)
    const item = doc.instances.find((entry) => entry.id === id)!
    const index = definition(item.definitionId)!.terminals.findIndex((t) => t.id === pin)
    if (
      (item.definitionId.startsWith('dpdt') || item.definitionId.startsWith('push-')) &&
      /^[ab][123]$/.test(pin)
    ) {
      return [
        {
          x:
            pin[0] === 'a'
              ? item.x - 12 - Number(pin[1]) * 8
              : item.x + componentWidth(item) + 12 + Number(pin[1]) * 8,
          y: point.y,
        },
      ]
    }
    // A short diagonal clears the lug label, then each port gets its own exit level.
    return [
      { x: point.x + 12, y: point.y + 8 },
      { x: point.x + 12, y: item.y + componentHeight(item) + 8 + index * 8 },
    ]
  }
  const a = escape(wire.from, start),
    b = escape(wire.to, end)
  const lastA = a[a.length - 1],
    lastB = b[b.length - 1]
  const side = (key: string) => {
    const [id, pin] = splitTerminalKey(key),
      item = doc.instances.find((entry) => entry.id === id)!
    return (item.definitionId.startsWith('dpdt') || item.definitionId.startsWith('push-')) &&
      /^[ab][123]$/.test(pin)
      ? pin[0] === 'a'
        ? -1
        : 1
      : 0
  }
  const sides = [side(wire.from), side(wire.to)],
    points = [lastA, lastB]
  const lower = Math.max(-Infinity, ...points.filter((_, i) => sides[i] === 1).map((p) => p.x))
  const upper = Math.min(Infinity, ...points.filter((_, i) => sides[i] === -1).map((p) => p.x))
  const middleX = Math.min(upper, Math.max(lower, (lastA.x + lastB.x) / 2))
  const corridor = Math.max(lastA.y, lastB.y) + 40
  const nearSideTurn = sides.some((value) => value !== 0) && Math.abs(lastA.y - lastB.y) < 18
  const middle =
    lower <= upper && !nearSideTurn
      ? [
          { x: middleX, y: lastA.y },
          { x: middleX, y: lastB.y },
        ]
      : [
          { x: lastA.x, y: corridor },
          { x: lower <= upper ? middleX : lastB.x, y: corridor },
          { x: lower <= upper ? middleX : lastB.x, y: lastB.y },
        ]
  return [start, ...a, ...middle, ...b.reverse(), end]
}

export const pointsAttribute = (points: { x: number; y: number }[]) =>
  points.map((point) => `${point.x},${point.y}`).join(' ')

export const diagramBounds = (doc: WireFactoryDocument) => {
  const maxX = Math.max(940, ...doc.instances.map((item) => item.x + componentWidth(item) + 40))
  const maxY = Math.max(720, ...doc.instances.map((item) => item.y + componentHeight(item) + 70))
  return { width: maxX, height: maxY }
}
