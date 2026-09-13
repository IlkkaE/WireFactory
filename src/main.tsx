import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { buildBomCsv, buildPdf, buildSvg } from './circuit/export'
import { stringifyProject } from './circuit/file'
import {
  CARD_WIDTH,
  componentHeight,
  diagramBounds,
  pointsAttribute,
  terminalPosition,
  wirePoints,
} from './circuit/layout'
import type { PotState, SelectorState } from './circuit/model'
import { catalog, catalogCategories, definition } from './circuit/catalog'
import { resolve } from './circuit/resolver'
import { useCircuitStore } from './store'
import './style.css'

const download = (name: string, data: BlobPart, type: string) => {
  const href = URL.createObjectURL(new Blob([data], { type }))
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(href), 250)
}

const safeFilename = (title: string) =>
  title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'wirefactory-project'

type DragState = {
  id: string
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  x: number
  y: number
}

function App() {
  const state = useCircuitStore()
  const input = useRef<HTMLInputElement>(null)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogCategory, setCatalogCategory] = useState('All')
  const [catalogSelection, setCatalogSelection] = useState('hb-2c-braid')
  const [dragging, setDragging] = useState<DragState | null>(null)
  const [notice, setNotice] = useState('')

  const displayDoc = useMemo(() => {
    if (!dragging) return state.doc
    const next = structuredClone(state.doc)
    const item = next.instances.find((entry) => entry.id === dragging.id)
    if (item) {
      item.x = dragging.x
      item.y = dragging.y
    }
    return next
  }, [dragging, state.doc])
  const resolved = useMemo(() => resolve(displayDoc, state.controls), [displayDoc, state.controls])
  const bounds = diagramBounds(displayDoc)
  const activeWireIds = new Set(resolved.activeWireIds)
  const activeTerminals = new Set(resolved.activeTerminals)
  const selectedComponent = state.doc.instances.find((item) => item.id === state.selected)
  const selectedDefinition = selectedComponent
    ? definition(selectedComponent.definitionId)
    : definition(catalogSelection)
  const selectedWire = state.doc.wires.find((wire) => wire.id === state.selectedWire)
  const visibleCatalog = catalog.filter(
    (item) =>
      (catalogCategory === 'All' || item.category === catalogCategory) &&
      `${item.name} ${item.summary} ${item.example}`
        .toLowerCase()
        .includes(catalogSearch.toLowerCase()),
  )

  const wireTerminal = (key: string) => {
    if (state.pendingTerminal) {
      state.wire(state.pendingTerminal, key)
      state.setPendingTerminal(null)
    } else {
      state.setPendingTerminal(key)
    }
  }

  const beginDrag = (event: ReactPointerEvent, id: string, x: number, y: number) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging({
      id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: x,
      startY: y,
      x,
      y,
    })
  }

  const continueDrag = (event: ReactPointerEvent) => {
    setDragging((current) =>
      current
        ? {
            ...current,
            x: Math.max(0, current.startX + event.clientX - current.startClientX),
            y: Math.max(0, current.startY + event.clientY - current.startClientY),
          }
        : null,
    )
  }

  const finishDrag = () => {
    if (!dragging) return
    state.move(dragging.id, dragging.x, dragging.y)
    setDragging(null)
  }

  const exportSnapshot = async (kind: 'svg' | 'pdf' | 'bom') => {
    if (!resolved.buildReady) return
    const filename = safeFilename(state.doc.title)
    if (kind === 'svg') {
      download(
        `${filename}.svg`,
        buildSvg(state.doc, resolve(state.doc, state.controls)),
        'image/svg+xml',
      )
    } else if (kind === 'bom') {
      download(`${filename}-bom.csv`, buildBomCsv(state.doc), 'text/csv;charset=utf-8')
    } else {
      const bytes = await buildPdf(state.doc, resolve(state.doc, state.controls))
      const buffer = new Uint8Array(bytes).buffer
      download(`${filename}.pdf`, buffer, 'application/pdf')
    }
  }

  return (
    <main
      onKeyDown={(event) => {
        if (event.key === 'Escape') state.setPendingTerminal(null)
        if (event.key === 'Delete' && state.selectedWire) state.removeWire(state.selectedWire)
        if (event.key === 'Delete' && state.selected) state.remove(state.selected)
      }}
      tabIndex={-1}
    >
      <header className="app-header">
        <div className="brand-block">
          <div className="wordmark" aria-label="WireFactory">
            <span>WIRE</span>
            <span>FACTORY</span>
          </div>
          <span className="subtitle">PASSIVE GUITAR WIRING WORKSPACE / V1</span>
        </div>
        <div className={resolved.buildReady ? 'status ready' : 'status'} data-testid="build-status">
          <span className="status-dot" />
          {resolved.buildReady
            ? 'BUILD READY'
            : `DRAFT · ${resolved.diagnostics.filter((entry) => entry.severity === 'error').length} ERRORS`}
        </div>
      </header>

      <section className="toolbar" aria-label="Project and export tools">
        <div className="tool-group">
          <button onClick={() => state.reset()}>New starter</button>
          <button disabled={!state.past.length} onClick={() => state.undo()}>
            Undo
          </button>
          <button disabled={!state.future.length} onClick={() => state.redo()}>
            Redo
          </button>
        </div>
        <div className="tool-group">
          <button onClick={() => input.current?.click()}>Open</button>
          <input
            ref={input}
            type="file"
            accept=".wirefactory,application/json"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              try {
                state.open(await file.text())
                setNotice(`Opened ${file.name}`)
              } catch (error) {
                setNotice(error instanceof Error ? error.message : 'Open failed.')
              }
              event.currentTarget.value = ''
            }}
          />
          <button
            onClick={() =>
              download(
                `${safeFilename(state.doc.title)}.wirefactory`,
                stringifyProject(state.doc),
                'application/json',
              )
            }
          >
            Save project
          </button>
        </div>
        <div className="tool-group export-group">
          <span>BUILD OUTPUT</span>
          <button disabled={!resolved.buildReady} onClick={() => void exportSnapshot('svg')}>
            SVG
          </button>
          <button disabled={!resolved.buildReady} onClick={() => void exportSnapshot('pdf')}>
            PDF
          </button>
          <button disabled={!resolved.buildReady} onClick={() => void exportSnapshot('bom')}>
            BOM
          </button>
        </div>
        {notice && (
          <button className="notice" onClick={() => setNotice('')} aria-label="Dismiss message">
            {notice} ×
          </button>
        )}
      </section>

      <section className="control-strip" aria-label="Circuit state">
        <strong>LIVE CIRCUIT STATE</strong>
        <label>
          Selector
          <select
            aria-label="Selector state"
            value={state.controls.selector}
            onChange={(event) => state.setControl('selector', event.target.value as SelectorState)}
          >
            <option value="neck">Neck</option>
            <option value="middle">Middle</option>
            <option value="bridge">Bridge</option>
          </select>
        </label>
        <label>
          Neck volume
          <select
            aria-label="Neck volume"
            value={state.controls.neckVolume}
            onChange={(event) => state.setControl('neckVolume', event.target.value as PotState)}
          >
            <option value="zero">0</option>
            <option value="mid">5</option>
            <option value="full">10</option>
          </select>
        </label>
        <label>
          Bridge volume
          <select
            aria-label="Bridge volume"
            value={state.controls.bridgeVolume}
            onChange={(event) => state.setControl('bridgeVolume', event.target.value as PotState)}
          >
            <option value="zero">0</option>
            <option value="mid">5</option>
            <option value="full">10</option>
          </select>
        </label>
        <label>
          Master tone
          <select
            aria-label="Master tone"
            value={state.controls.tone}
            onChange={(event) => state.setControl('tone', event.target.value as PotState)}
          >
            <option value="zero">0</option>
            <option value="mid">5</option>
            <option value="full">10</option>
          </select>
        </label>
        <span className={resolved.outputMuted ? 'live-result muted' : 'live-result'}>
          {resolved.outputMuted
            ? 'OUTPUT MUTED'
            : resolved.paths
                .filter((path) => path.active)
                .map((path) => path.pickup.toUpperCase())
                .join(' + ') || 'NO ACTIVE PATH'}
        </span>
      </section>

      <div className="workspace">
        <aside className="catalog-panel" aria-label="Component catalog">
          <div className="panel-heading">
            <span>01</span>
            <h2>Component library</h2>
          </div>
          <input
            className="catalog-search"
            type="search"
            placeholder="Search components"
            aria-label="Search components"
            value={catalogSearch}
            onChange={(event) => setCatalogSearch(event.target.value)}
          />
          <select
            className="category-select"
            aria-label="Catalog category"
            value={catalogCategory}
            onChange={(event) => setCatalogCategory(event.target.value)}
          >
            <option>All</option>
            {catalogCategories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
          <div className="catalog-list">
            {visibleCatalog.map((item) => (
              <article
                className={catalogSelection === item.id ? 'catalog-item selected' : 'catalog-item'}
                key={item.id}
                onClick={() => setCatalogSelection(item.id)}
              >
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.category}</small>
                </div>
                <button
                  aria-label={`Add ${item.name}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    state.add(item.id)
                  }}
                >
                  +
                </button>
              </article>
            ))}
          </div>
        </aside>

        <section className="canvas-panel" aria-label="Wiring canvas panel">
          <div className="canvas-header">
            <div>
              <span>02</span>
              <strong>WIRING BOARD</strong>
            </div>
            <p>
              {state.pendingTerminal
                ? `FROM ${state.pendingTerminal} · SELECT DESTINATION · ESC CANCELS`
                : 'TAP TERMINALS TO WIRE · DRAG COMPONENT HEADERS TO MOVE'}
            </p>
          </div>
          <div className="canvas-scroll" data-testid="canvas-scroll">
            <div
              className="canvas"
              style={{ width: bounds.width, height: bounds.height }}
              onClick={() => {
                state.setSelected(null)
                state.setSelectedWire(null)
              }}
            >
              <svg
                className="wire-layer"
                width={bounds.width}
                height={bounds.height}
                viewBox={`0 0 ${bounds.width} ${bounds.height}`}
                aria-label="Wire geometry"
              >
                {displayDoc.wires.map((wire) => {
                  const points = pointsAttribute(wirePoints(displayDoc, wire))
                  const active = activeWireIds.has(wire.id)
                  const selected = state.selectedWire === wire.id
                  return (
                    <g key={wire.id}>
                      <polyline
                        className="wire-hit"
                        points={points}
                        onClick={(event) => {
                          event.stopPropagation()
                          state.setSelectedWire(wire.id)
                        }}
                      />
                      <polyline
                        className={`wire ${active ? 'active' : ''} ${selected ? 'selected' : ''}`}
                        points={points}
                        stroke={wire.color}
                        data-wire-id={wire.id}
                      />
                    </g>
                  )
                })}
              </svg>
              {displayDoc.instances.map((item) => {
                const itemDefinition = definition(item.definitionId)
                return (
                  <article
                    className={`component ${state.selected === item.id ? 'selected' : ''}`}
                    key={item.id}
                    style={{
                      left: item.x,
                      top: item.y,
                      width: CARD_WIDTH,
                      height: componentHeight(item),
                    }}
                    data-component-id={item.id}
                    onClick={(event) => {
                      event.stopPropagation()
                      state.setSelected(item.id)
                    }}
                  >
                    <div
                      className="component-drag-handle"
                      onPointerDown={(event) => beginDrag(event, item.id, item.x, item.y)}
                      onPointerMove={continueDrag}
                      onPointerUp={finishDrag}
                      onPointerCancel={() => setDragging(null)}
                    >
                      <strong>{item.label}</strong>
                      <small>{itemDefinition?.name}</small>
                      <span aria-hidden="true">⠿</span>
                    </div>
                    {itemDefinition?.terminals.map((terminal) => {
                      const key = `${item.id}:${terminal.id}`
                      const point = terminalPosition(displayDoc, key)!
                      return (
                        <button
                          className={`terminal ${activeTerminals.has(key) ? 'active' : ''} ${state.pendingTerminal === key ? 'pending' : ''}`}
                          style={{ left: point.x - item.x - 10, top: point.y - item.y - 10 }}
                          key={key}
                          aria-label={`${item.label}: ${terminal.label}`}
                          title={`${terminal.label} · ${terminal.role}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            wireTerminal(key)
                          }}
                        >
                          <span>{terminal.label}</span>
                        </button>
                      )
                    })}
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <aside className="inspector-panel" aria-label="Inspector and validation">
          <div className="panel-heading">
            <span>03</span>
            <h2>Inspector</h2>
          </div>
          {selectedWire ? (
            <section className="inspector-section">
              <p className="eyebrow">SELECTED WIRE</p>
              <h3>{selectedWire.id}</h3>
              <dl>
                <dt>From</dt>
                <dd>{selectedWire.from}</dd>
                <dt>To</dt>
                <dd>{selectedWire.to}</dd>
                <dt>Role</dt>
                <dd>{selectedWire.role}</dd>
              </dl>
              <button className="danger" onClick={() => state.removeWire(selectedWire.id)}>
                Delete wire
              </button>
            </section>
          ) : selectedDefinition ? (
            <section className="inspector-section">
              <p className="eyebrow">{selectedComponent ? 'SELECTED COMPONENT' : 'CATALOG INFO'}</p>
              <h3>{selectedComponent?.label ?? selectedDefinition.name}</h3>
              <p>{selectedDefinition.summary}</p>
              <p className="example">
                <b>Example</b>
                {selectedDefinition.example}
              </p>
              <p className="limitation">{selectedDefinition.limitation}</p>
              <a href={selectedDefinition.sourceUrl} target="_blank" rel="noreferrer">
                {selectedDefinition.source} ↗
              </a>
              {selectedComponent && (
                <button className="danger" onClick={() => state.remove(selectedComponent.id)}>
                  Delete component
                </button>
              )}
            </section>
          ) : null}

          <section className="validation-section">
            <div className="section-title">
              <h3>Validation</h3>
              <span>{resolved.diagnostics.length}</span>
            </div>
            {resolved.diagnostics.length === 0 ? (
              <p className="validation-ok">All verified starter checks pass.</p>
            ) : (
              resolved.diagnostics.slice(0, 8).map((entry, index) => (
                <article className={`diagnostic ${entry.severity}`} key={`${entry.code}-${index}`}>
                  <strong>{entry.code}</strong>
                  <p>{entry.message}</p>
                </article>
              ))
            )}
          </section>

          <section className="function-section">
            <div className="section-title">
              <h3>Function table</h3>
              <span>3 states</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Switch</th>
                  <th>Neck</th>
                  <th>Bridge</th>
                </tr>
              </thead>
              <tbody>
                {resolved.functionTable.map((row) => (
                  <tr
                    key={row.selector}
                    className={row.selector === state.controls.selector ? 'current' : ''}
                  >
                    <td>{row.selector}</td>
                    <td>{row.neck ? 'ON' : '—'}</td>
                    <td>{row.bridge ? 'ON' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <p className="safety-note">
            Build-ready covers only the exact generic starter topology. Confirm the actual pickup
            colour code, switch matrix, jack lugs and continuity before soldering.
          </p>
        </aside>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
