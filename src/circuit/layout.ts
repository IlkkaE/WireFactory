import { definition } from './catalog'
import { splitTerminalKey, type Instance, type Wire, type WireFactoryDocument } from './model'

export const CARD_WIDTH = 190
export const TERMINALS_PER_ROW = 4

export const componentHeight = (instance: Instance) => {
  const count = definition(instance.definitionId)?.terminals.length ?? 1
  return 74 + Math.ceil(count / TERMINALS_PER_ROW) * 34
}

export const terminalPosition = (doc: WireFactoryDocument, key: string) => {
  const [instanceId, terminalId] = splitTerminalKey(key)
  const instance = doc.instances.find((item) => item.id === instanceId)
  const terminals = instance ? (definition(instance.definitionId)?.terminals ?? []) : []
  const index = terminals.findIndex((terminal) => terminal.id === terminalId)
  if (!instance || index < 0) return null
  const column = index % TERMINALS_PER_ROW
  const row = Math.floor(index / TERMINALS_PER_ROW)
  const columnsInRow = Math.min(TERMINALS_PER_ROW, terminals.length - row * TERMINALS_PER_ROW)
  const gap = CARD_WIDTH / (columnsInRow + 1)
  return {
    x: instance.x + gap * (column + 1),
    y: instance.y + 82 + row * 34,
  }
}

export const wirePoints = (doc: WireFactoryDocument, wire: Wire) => {
  const start = terminalPosition(doc, wire.from)
  const end = terminalPosition(doc, wire.to)
  if (!start || !end) return []
  if (wire.waypoints.length) return [start, ...wire.waypoints, end]
  const middleX = (start.x + end.x) / 2
  return [start, { x: middleX, y: start.y }, { x: middleX, y: end.y }, end]
}

export const pointsAttribute = (points: { x: number; y: number }[]) =>
  points.map((point) => `${point.x},${point.y}`).join(' ')

export const diagramBounds = (doc: WireFactoryDocument) => {
  const maxX = Math.max(940, ...doc.instances.map((item) => item.x + CARD_WIDTH + 40))
  const maxY = Math.max(720, ...doc.instances.map((item) => item.y + componentHeight(item) + 45))
  return { width: maxX, height: maxY }
}
