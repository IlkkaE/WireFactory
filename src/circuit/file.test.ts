import { describe, expect, it } from 'vitest'
import { parseProject, stringifyProject } from './file'
import { starterDocument } from './template'

describe('.wirefactory parser', () => {
  it('round-trips the v1 starter without changing it', () => {
    const document = starterDocument()
    expect(parseProject(stringifyProject(document))).toEqual(document)
  })

  it('rejects unsupported document and pinout versions', () => {
    const version = JSON.parse(stringifyProject(starterDocument())) as Record<string, unknown>
    version.version = 2
    expect(() => parseProject(JSON.stringify(version))).toThrow('Unsupported .wirefactory')

    const pinoutVersion = starterDocument()
    pinoutVersion.instances[0].pinoutVersion = 2 as 1
    expect(() => parseProject(stringifyProject(pinoutVersion))).toThrow('Unknown component')
  })

  it('rejects an unknown pinout id before returning a document', () => {
    const document = starterDocument()
    document.instances[0].pinoutId = 'not-a-known-pinout'
    expect(() => parseProject(stringifyProject(document))).toThrow('Unknown component')
  })

  it('rejects unknown terminal endpoints and duplicate ids', () => {
    const invalidEndpoint = starterDocument()
    invalidEndpoint.wires[0].from = 'neck:does-not-exist'
    expect(() => parseProject(stringifyProject(invalidEndpoint))).toThrow('Invalid wire endpoint')

    const duplicate = starterDocument()
    duplicate.instances[1].id = duplicate.instances[0].id
    expect(() => parseProject(stringifyProject(duplicate))).toThrow('Duplicate component id')
  })

  it('rejects the v1 safety limits', () => {
    const oversized = starterDocument()
    oversized.instances = Array.from({ length: 81 }, (_, index) => ({
      ...oversized.instances[0],
      id: `pickup-${index}`,
    }))
    expect(() => parseProject(stringifyProject(oversized))).toThrow('safety limits')
  })
})
