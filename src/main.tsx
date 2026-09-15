import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { buildBomCsv, buildPdf, buildSvg } from './circuit/export'
import { stringifyProject } from './circuit/file'
import {
  componentWidth,
  componentHeight,
  diagramBounds,
  pointsAttribute,
  terminalPosition,
  wirePoints,
} from './circuit/layout'
import type { PotState, SelectorState } from './circuit/model'
import { catalog, catalogCategories, definition } from './circuit/catalog'
import { renderComponentSvg } from './circuit/componentGeometry'
import { electricalFingerprint, type ResolvedCircuit } from './circuit/resolver'
import { switchStateLabel } from './circuit/switchLabels'
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

const UNCHECKED_RESULT: ResolvedCircuit = {
  diagnostics: [],
  paths: [],
  functionTable: [],
  coilInfluence: [],
  activeTerminals: [],
  activeWireIds: [],
  buildReady: false,
  incomplete: false,
  outputMuted: false,
  verificationStatus: 'invalid',
  structuralStatus: 'invalid',
  expectationStatus: 'none',
  topology: null,
  outputs: [],
  outputObservations: {},
}

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
  const [catalogCategory, setCatalogCategory] = useState(catalogCategories[0] ?? '')
  const [catalogSelection, setCatalogSelection] = useState('hb-2c-braid')
  const [preset, setPreset] = useState('starter')
  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const fileMenu = useRef<HTMLDivElement>(null)
  const fileTrigger = useRef<HTMLButtonElement>(null)
  const [dragging, setDragging] = useState<DragState | null>(null)
  const [notice, setNotice] = useState('')
  const canvasScroll = useRef<HTMLDivElement>(null)
  const diagnosticButtons = useRef<Record<number, HTMLButtonElement | null>>({})

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
  const fingerprint = useMemo(
    () => electricalFingerprint(state.doc, state.controls),
    [state.doc, state.controls],
  )
  const checked = state.checks[fingerprint]
  const resolved = checked ?? UNCHECKED_RESULT
  const bounds = diagramBounds(displayDoc)
  const activeWireIds = new Set(resolved.activeWireIds)
  const activeTerminals = new Set(resolved.activeTerminals)
  const selectedDiagnostic =
    state.selectedDiagnostic === null
      ? null
      : (resolved.diagnostics[state.selectedDiagnostic] ?? null)
  const diagnosticComponentIds = new Set(selectedDiagnostic?.componentIds ?? [])
  const diagnosticTerminalIds = new Set(selectedDiagnostic?.terminals ?? [])
  const diagnosticWireIds = new Set(selectedDiagnostic?.wireIds ?? [])
  const showDiagnosticInDiagram = () => {
    if (!selectedDiagnostic) return
    const canvas = canvasScroll.current
    const escaped = (id: string) => CSS.escape(id)
    const target =
      selectedDiagnostic.terminals
        ?.map((id) => document.querySelector('[data-terminal-id="' + escaped(id) + '"]'))
        .find(Boolean) ??
      selectedDiagnostic.wireIds
        ?.map((id) => document.querySelector('[data-wire-id="' + escaped(id) + '"]'))
        .find(Boolean) ??
      selectedDiagnostic.componentIds
        ?.map((id) => document.querySelector('[data-component-id="' + escaped(id) + '"]'))
        .find(Boolean)
    if (!canvas || !(target instanceof Element)) return
    const box = target.getBoundingClientRect()
    const frame = canvas.getBoundingClientRect()
    canvas.scrollBy({
      left: box.left - frame.left - frame.width / 2 + box.width / 2,
      top: box.top - frame.top - frame.height / 2 + box.height / 2,
      behavior: 'instant',
    })
    canvas.closest('.canvas-panel')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
  const selectedComponent = state.doc.instances.find((item) => item.id === state.selected)
  const selectedDefinition = selectedComponent
    ? definition(selectedComponent.definitionId)
    : definition(catalogSelection)
  const selectedWire = state.doc.wires.find((wire) => wire.id === state.selectedWire)
  const visibleCatalog = catalog.filter(
    (item) => item.id !== 'spst-on-on' && item.category === catalogCategory,
  )
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (fileMenu.current && !fileMenu.current.contains(event.target as Node))
        setFileMenuOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [])

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
    if (!checked || !resolved.buildReady) return
    const filename = safeFilename(state.doc.title)
    if (kind === 'svg') {
      download(`${filename}.svg`, buildSvg(state.doc, resolved), 'image/svg+xml')
    } else if (kind === 'bom') {
      download(`${filename}-bom.csv`, buildBomCsv(state.doc), 'text/csv;charset=utf-8')
    } else {
      const bytes = await buildPdf(state.doc, resolved)
      const buffer = new Uint8Array(bytes).buffer
      download(`${filename}.pdf`, buffer, 'application/pdf')
    }
  }

  return (
    <main
      onKeyDown={(event) => {
        if (event.key === 'Escape' && fileMenuOpen) {
          setFileMenuOpen(false)
          fileTrigger.current?.focus()
          return
        }
        if (event.key === 'Escape') state.setPendingTerminal(null)
        if (
          (event.target as HTMLElement).closest(
            'input, select, button, textarea, [contenteditable="true"], .file-menu',
          )
        )
          return
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
        <div
          className={checked && resolved.buildReady ? 'status ready' : 'status'}
          data-testid="build-status"
        >
          <span className="status-dot" />
          {!checked
            ? Object.keys(state.checks).length
              ? 'CHANGES NOT CHECKED · EXPORT BLOCKED'
              : 'NOT CHECKED · EXPORT BLOCKED'
            : resolved.verificationStatus === 'verified'
              ? 'BUILD READY · STRUCTURALLY VALID'
              : resolved.structuralStatus === 'unknown'
                ? 'UNKNOWN · EXPORT BLOCKED'
                : `INVALID · ${resolved.diagnostics.filter((entry) => entry.severity === 'error').length} ERRORS`}
        </div>
      </header>

      <section className="toolbar" aria-label="Project and export tools">
        <div className="toolbar-card preset-card">
          <label>
            Preset
            <select
              aria-label="Preset"
              value={preset}
              onChange={(event) => setPreset(event.target.value)}
            >
              <option value="starter">2HB / 2V / 1T</option>
              <option value="master">2HB / 1V / 1T</option>
              <option value="pull">Dual split / push-pull</option>
              <option value="push">Dual split / push-push</option>
              <option value="fiveway">3S / 5-way / 1V / 1T</option>
              <option value="seriesparallel">2S / Parallel-Series / 1V / 1T</option>
            </select>
          </label>
          <button
            onClick={() => {
              if (preset === 'starter') state.reset()
              else if (preset === 'master') state.newMasterVolume()
              else if (preset === 'fiveway') state.newFiveWay()
              else if (preset === 'seriesparallel') state.newSeriesParallel()
              else state.newSplit(preset === 'pull' ? 'push-pull-dpdt' : 'push-push-dpdt')
            }}
          >
            Load preset
          </button>
          <button onClick={() => state.check()} disabled={!!dragging}>
            Check wiring
          </button>
          <button disabled={!state.past.length} onClick={() => state.undo()}>
            Undo
          </button>
          <button disabled={!state.future.length} onClick={() => state.redo()}>
            Redo
          </button>
        </div>
        <div
          className="file-menu"
          ref={fileMenu}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
              setFileMenuOpen(false)
          }}
        >
          <button
            ref={fileTrigger}
            aria-controls="file-actions"
            aria-expanded={fileMenuOpen}
            onClick={() => setFileMenuOpen((open) => !open)}
          >
            File...
          </button>
          {fileMenuOpen && (
            <div className="file-popover" id="file-actions" aria-label="File actions">
              <button
                onClick={() => {
                  input.current?.click()
                  setFileMenuOpen(false)
                }}
              >
                Open
              </button>
              <button
                onClick={() => {
                  download(
                    safeFilename(state.doc.title) + '.wirefactory',
                    stringifyProject(state.doc),
                    'application/json',
                  )
                  setFileMenuOpen(false)
                }}
              >
                Save project
              </button>
              <button
                disabled={!checked || !resolved.buildReady}
                onClick={() => {
                  void exportSnapshot('svg')
                  setFileMenuOpen(false)
                }}
              >
                SVG
              </button>
              <button
                disabled={!checked || !resolved.buildReady}
                onClick={() => {
                  void exportSnapshot('pdf')
                  setFileMenuOpen(false)
                }}
              >
                PDF
              </button>
              <button
                disabled={!checked || !resolved.buildReady}
                onClick={() => {
                  void exportSnapshot('bom')
                  setFileMenuOpen(false)
                }}
              >
                BOM
              </button>
            </div>
          )}
          <input
            ref={input}
            type="file"
            accept=".wirefactory,application/json"
            hidden
            onChange={async (event) => {
              const inputElement = event.currentTarget
              const file = inputElement.files?.[0]
              if (!file) return
              try {
                state.open(await file.text())
                setNotice('Opened ' + file.name)
              } catch (error) {
                setNotice(error instanceof Error ? error.message : 'Open failed.')
              }
              inputElement.value = ''
            }}
          />
        </div>
      </section>
      {notice && (
        <button className="notice" onClick={() => setNotice('')} aria-label="Dismiss message">
          {notice} ×
        </button>
      )}

      <section className="control-strip" aria-label="Circuit state">
        <strong>LIVE CIRCUIT STATE</strong>
        {state.doc.instances.some(
          (i) => i.values.control === 'selector' && i.definitionId === 'three-way-toggle',
        ) && (
          <label>
            Selector
            <select
              aria-label="Selector state"
              value={state.controls.selector}
              onChange={(event) =>
                state.setControl('selector', event.target.value as SelectorState)
              }
            >
              <option value="neck">Neck</option>
              <option value="middle">Middle</option>
              <option value="bridge">Bridge</option>
            </select>
          </label>
        )}
        {state.doc.instances.some((item) => item.values.control === 'neck-volume') && (
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
        )}
        {state.doc.instances.some((item) => item.values.control === 'bridge-volume') && (
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
        )}
        {state.doc.instances.some((item) => item.values.control === 'master-volume') && (
          <label>
            Master volume
            <select
              aria-label="Master volume"
              value={state.controls.masterVolume}
              onChange={(event) => state.setControl('masterVolume', event.target.value as PotState)}
            >
              <option value="zero">0</option>
              <option value="mid">5</option>
              <option value="full">10</option>
            </select>
          </label>
        )}
        {state.doc.instances.some((i) => i.values.control === 'tone') && (
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
        )}
        {state.doc.instances
          .filter((item) => item.values.control === 'tone' && item.definitionId.startsWith('push-'))
          .map((item) => (
            <label key={item.id}>
              Dual split
              <select
                aria-label="Dual split"
                value={item.controlState ?? 'full'}
                onChange={(event) => state.setComponentState(item.id, event.target.value)}
              >
                <option value="full">Full humbuckers</option>
                <option value="split">Split coils</option>
              </select>
            </label>
          ))}
        <span className={resolved.outputMuted ? 'live-result muted' : 'live-result'}>
          {!checked
            ? 'CHECK REQUIRED'
            : resolved.outputMuted
              ? 'OUTPUT MUTED'
              : resolved.paths
                  .filter((path) => path.active)
                  .map(
                    (path) =>
                      state.doc.instances.find((i) => i.id === path.pickup)?.label ?? path.pickup,
                  )
                  .join(' + ') || 'NO ACTIVE PATH'}
        </span>
        {resolved.paths.some((path) => path.coilMode) && (
          <span className="coil-result" data-testid="coil-result">
            {resolved.paths
              .map(
                (path) =>
                  (state.doc.instances.find((i) => i.id === path.pickup)?.label ?? path.pickup) +
                  ': ' +
                  path.coilCount +
                  (path.coilCount === 1 ? ' COIL' : ' COILS') +
                  ' (' +
                  path.coilMode +
                  ')',
              )
              .join(' / ')}
          </span>
        )}
      </section>

      <div className="workspace">
        <aside className="catalog-panel" aria-label="Component catalog">
          <div className="panel-heading">
            <span>01</span>
            <h2>Components</h2>
          </div>
          <label>
            Component group
            <select
              aria-label="Component group"
              value={catalogCategory}
              onChange={(event) => {
                const category = event.target.value
                setCatalogCategory(category)
                setCatalogSelection(
                  catalog.find((item) => item.id !== 'spst-on-on' && item.category === category)
                    ?.id ?? '',
                )
              }}
            >
              {catalogCategories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            Component type
            <select
              aria-label="Component type"
              value={catalogSelection}
              onChange={(event) => setCatalogSelection(event.target.value)}
            >
              {visibleCatalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button className="add-component" onClick={() => state.add(catalogSelection)}>
            Add component
          </button>
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
          {selectedDiagnostic && (
            <div className="diagnostic-navigation" role="region" aria-label="Diagnostic highlight">
              <p>
                <strong>{selectedDiagnostic.title}</strong> · Related connections, not a confirmed
                fault location.
              </p>
              <div>
                <button
                  className="diagnostic-back"
                  onClick={() => {
                    const button = diagnosticButtons.current[state.selectedDiagnostic ?? 0]
                    button?.scrollIntoView({ block: 'center' })
                    button?.focus({ preventScroll: true })
                  }}
                >
                  Back to diagnostic
                </button>
                <button
                  className="diagnostic-clear"
                  onClick={() => state.setSelectedDiagnostic(null)}
                >
                  Clear highlight
                </button>
              </div>
            </div>
          )}
          <div className="canvas-scroll" data-testid="canvas-scroll" ref={canvasScroll}>
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
                  const diagnosed = diagnosticWireIds.has(wire.id)
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
                        className={`wire ${active ? 'active' : ''} ${selected ? 'selected' : ''} ${diagnosed ? 'diagnostic-target' : ''}`}
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
                    className={`component ${state.selected === item.id ? 'selected' : ''} ${diagnosticComponentIds.has(item.id) ? 'diagnostic-target' : ''}`}
                    key={item.id}
                    style={{
                      left: item.x,
                      top: item.y,
                      width: componentWidth(item),
                      height: componentHeight(item),
                    }}
                    data-component-id={item.id}
                    onClick={(event) => {
                      event.stopPropagation()
                      state.setSelected(item.id)
                    }}
                  >
                    <div
                      className="component-silhouette"
                      dangerouslySetInnerHTML={{ __html: renderComponentSvg(item) }}
                    />
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
                          className={`terminal ${activeTerminals.has(key) ? 'active' : ''} ${state.pendingTerminal === key ? 'pending' : ''} ${diagnosticTerminalIds.has(key) ? 'diagnostic-target' : ''}`}
                          style={{ left: point.x - item.x - 10, top: point.y - item.y - 10 }}
                          key={key}
                          aria-label={`${item.label}: ${terminal.label}`}
                          title={`${terminal.label} · ${terminal.role}`}
                          data-terminal-id={key}
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
              <p className="limitation">{selectedDefinition.limitation}</p>
              {selectedComponent && selectedDefinition.contactModel && (
                <label className="switch-state">
                  Switch state
                  <select
                    aria-label="Switch state"
                    value={
                      selectedComponent.controlState ?? selectedDefinition.contactModel.defaultState
                    }
                    onChange={(event) =>
                      state.setComponentState(selectedComponent.id, event.target.value)
                    }
                  >
                    {selectedDefinition.contactModel.states.map((option) => (
                      <option key={option.id} value={option.id}>
                        {switchStateLabel(selectedComponent, option)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
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
            {!checked ? (
              <p>Run Check wiring to inspect this circuit.</p>
            ) : resolved.diagnostics.length === 0 ? (
              <p className="validation-ok">Structural checks pass.</p>
            ) : (
              <div className="diagnostic-list">
                {resolved.diagnostics.map((entry, index) => (
                  <article
                    className={`diagnostic ${entry.severity} ${state.selectedDiagnostic === index ? 'selected' : ''}`}
                    key={entry.key ?? `${entry.code}-${index}`}
                  >
                    <button
                      className="diagnostic-select"
                      aria-pressed={state.selectedDiagnostic === index}
                      ref={(element) => {
                        diagnosticButtons.current[index] = element
                      }}
                      onClick={() => state.setSelectedDiagnostic(index)}
                    >
                      <strong>{entry.title}</strong>
                      <span>{entry.code}</span>
                    </button>
                    <p>{entry.message}</p>
                    {state.selectedDiagnostic === index && (
                      <div className="diagnostic-detail">
                        <p>
                          <strong>Suggested next step</strong>
                          {entry.suggestion}
                        </p>
                        {entry.componentIds?.length ||
                        entry.terminals.length ||
                        entry.wireIds?.length ? (
                          <button onClick={showDiagnosticInDiagram}>Show in diagram</button>
                        ) : (
                          <p className="diagnostic-global">
                            This result applies to the whole circuit, so no individual part is
                            highlighted.
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          {checked && (
            <section className="function-section">
              <div className="section-title">
                <h3>Function table</h3>
                <span>{resolved.functionTable.length} states</span>
              </div>
              <p className="eyebrow">
                Nominal volume / tone. Current control results are shown above.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Switch state</th>
                    <th>Contributing sources</th>
                    <th>Output</th>
                  </tr>
                </thead>
                <tbody>
                  {resolved.functionTable.map((row) => (
                    <tr key={row.key} className={row.current ? 'current' : ''}>
                      <td>{row.selector}</td>
                      <td>
                        {row.sources
                          .map(
                            (source) =>
                              state.doc.instances.find((i) => i.id === source)?.label ?? source,
                          )
                          .join(' + ') || '—'}
                      </td>
                      <td>
                        {Object.entries(row.outputs)
                          .map(([id, o]) => id + ': ' + o.state.toUpperCase())
                          .join(' / ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          <p className="safety-note">
            Check wiring analyzes possible source contribution, not sound or frequency response.
            Electrical edits require a new check before export. Confirm the actual pickup colour
            code, switch matrix, jack lugs and continuity before soldering.
          </p>
        </aside>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
