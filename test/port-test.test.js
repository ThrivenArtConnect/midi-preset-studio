import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  isMpd24PortName,
  findMpd24PortIndices,
  planPortsToOpen,
  isRelevantNoteOn,
  parseNoteOnEvent,
  createPortTestController,
} = require('../src/main/port-test.js')

const REAL_PORT_NAMES = [
  'Akai MPD24 [2]',
  'Akai MPD24 [3]',
  'Akai MPD24 Anschluss 3 [4]',
  'IAC Driver Bus 1',
  'Arturia KeyStep 32',
  'Akai MPK Mini',
]

// Minimal Fake fuer midi.Input - keine echte Hardware noetig.
function makeFakeInputFactory() {
  const instances = []
  const factory = () => {
    const inst = {
      opened: null,
      closed: false,
      listeners: [],
      openPort(idx) {
        if (this.opened != null) throw new Error('already open')
        this.opened = idx
      },
      closePort() { this.closed = true },
      ignoreTypes() {},
      on(event, cb) { if (event === 'message') this.listeners.push(cb) },
      removeAllListeners(event) { if (!event || event === 'message') this.listeners = [] },
      emit(bytes) { this.listeners.forEach(cb => cb(0, bytes)) },
    }
    instances.push(inst)
    return inst
  }
  factory.instances = instances
  return factory
}

describe('isMpd24PortName / findMpd24PortIndices', () => {
  it('matches all three real MPD24 port name variants', () => {
    const matches = findMpd24PortIndices(REAL_PORT_NAMES)
    expect(matches.map(m => m.index)).toEqual([0, 1, 2])
    expect(matches.map(m => m.name)).toEqual([
      'Akai MPD24 [2]', 'Akai MPD24 [3]', 'Akai MPD24 Anschluss 3 [4]',
    ])
  })

  it('does not accept a foreign device as an MPD24 port (Akai alone is not enough)', () => {
    expect(isMpd24PortName('Akai MPK Mini')).toBe(false)
    expect(isMpd24PortName('IAC Driver Bus 1')).toBe(false)
    expect(isMpd24PortName('Arturia KeyStep 32')).toBe(false)
  })

  it('handles an empty port list safely', () => {
    expect(findMpd24PortIndices([])).toEqual([])
    expect(findMpd24PortIndices(undefined)).toEqual([])
  })
})

describe('planPortsToOpen', () => {
  it('reuses already-open matching indices and only plans the rest to open', () => {
    // Hauptinput auf [2] (idx 0), sysexInput auf Anschluss 3 [4] (idx 2) schon offen -> [3] (idx 1) fehlt
    const plan = planPortsToOpen(REAL_PORT_NAMES, [0, 2])
    expect(plan.matches.map(m => m.index)).toEqual([0, 1, 2])
    expect(plan.reuse.map(m => m.index)).toEqual([0, 2])
    expect(plan.toOpen.map(m => m.index)).toEqual([1])
  })

  it('plans all matches to open when nothing is already open', () => {
    const plan = planPortsToOpen(REAL_PORT_NAMES, [])
    expect(plan.toOpen.map(m => m.index)).toEqual([0, 1, 2])
    expect(plan.reuse).toEqual([])
  })

  it('returns an empty, safe plan when no MPD24 port is present', () => {
    const plan = planPortsToOpen(['IAC Driver Bus 1'], [])
    expect(plan.matches).toEqual([])
    expect(plan.reuse).toEqual([])
    expect(plan.toOpen).toEqual([])
  })
})

describe('isRelevantNoteOn / parseNoteOnEvent', () => {
  it('accepts Note-On with velocity > 0 on channel 1', () => {
    expect(isRelevantNoteOn([0x90, 60, 100])).toBe(true)
  })

  it('accepts Note-On with velocity > 0 on channel 16', () => {
    expect(isRelevantNoteOn([0x9f, 60, 1])).toBe(true)
  })

  it('rejects Note-On with velocity 0 (Note-Off equivalent)', () => {
    expect(isRelevantNoteOn([0x90, 60, 0])).toBe(false)
  })

  it('rejects real Note-Off (0x80)', () => {
    expect(isRelevantNoteOn([0x80, 60, 100])).toBe(false)
  })

  it('rejects Control Change', () => {
    expect(isRelevantNoteOn([0xb0, 20, 127])).toBe(false)
  })

  it('rejects Program Change (too short for the note-on shape anyway)', () => {
    expect(isRelevantNoteOn([0xc0, 5])).toBe(false)
  })

  it('rejects Pitch Bend', () => {
    expect(isRelevantNoteOn([0xe0, 0, 64])).toBe(false)
  })

  it('rejects SysEx', () => {
    expect(isRelevantNoteOn([0xf0, 0x47, 0x00, 0x68, 0xf7])).toBe(false)
  })

  it('rejects malformed/short messages', () => {
    expect(isRelevantNoteOn([0x90, 60])).toBe(false)
    expect(isRelevantNoteOn([])).toBe(false)
    expect(isRelevantNoteOn(null)).toBe(false)
  })

  it('parses note/velocity/channel (1-based) correctly', () => {
    expect(parseNoteOnEvent([0x91, 64, 90])).toEqual({ note: 64, velocity: 90, channel: 2 })
    expect(parseNoteOnEvent([0x90, 36, 127])).toEqual({ note: 36, velocity: 127, channel: 1 })
  })
})

describe('createPortTestController', () => {
  it('reports a structured, non-crashing result when no MPD24 port is found', () => {
    const factory = makeFakeInputFactory()
    const controller = createPortTestController({ midiInputFactory: factory })
    const result = controller.start({ portNames: ['IAC Driver Bus 1'], alreadyOpen: [], onEvent: () => {} })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Kein passender MPD24-Input-Port/)
    expect(controller.isActive()).toBe(false)
    expect(factory.instances).toHaveLength(0)
  })

  it('opens only the not-already-open matching ports', () => {
    const factory = makeFakeInputFactory()
    const controller = createPortTestController({ midiInputFactory: factory })
    const result = controller.start({
      portNames: REAL_PORT_NAMES,
      alreadyOpen: [{ index: 0, name: REAL_PORT_NAMES[0] }, { index: 2, name: REAL_PORT_NAMES[2] }],
      onEvent: () => {},
    })
    expect(result.ok).toBe(true)
    expect(result.opened).toEqual([{ index: 1, name: 'Akai MPD24 [3]' }])
    expect(factory.instances).toHaveLength(1)
    expect(factory.instances[0].opened).toBe(1)
    expect(controller.isActive()).toBe(true)
  })

  it('emits a port-test event for a relevant Note-On from a temporarily opened port', () => {
    const factory = makeFakeInputFactory()
    const controller = createPortTestController({ midiInputFactory: factory })
    const onEvent = vi.fn()
    controller.start({ portNames: REAL_PORT_NAMES, alreadyOpen: [], onEvent })

    factory.instances[1].emit([0x90, 48, 110]) // "Akai MPD24 [3]" (idx 1)

    expect(onEvent).toHaveBeenCalledTimes(1)
    const payload = onEvent.mock.calls[0][0]
    expect(payload.portIndex).toBe(1)
    expect(payload.portName).toBe('Akai MPD24 [3]')
    expect(payload.note).toBe(48)
    expect(payload.velocity).toBe(110)
    expect(payload.channel).toBe(1)
    expect(typeof payload.timestamp).toBe('number')
  })

  it('ignores Note-Off / velocity-0 / CC from a temporarily opened port', () => {
    const factory = makeFakeInputFactory()
    const controller = createPortTestController({ midiInputFactory: factory })
    const onEvent = vi.fn()
    controller.start({ portNames: REAL_PORT_NAMES, alreadyOpen: [], onEvent })

    factory.instances[0].emit([0x80, 60, 100])
    factory.instances[0].emit([0x90, 60, 0])
    factory.instances[0].emit([0xb0, 1, 127])

    expect(onEvent).not.toHaveBeenCalled()
  })

  it('forwardMessage() lets an already-open port participate without opening a new instance', () => {
    const factory = makeFakeInputFactory()
    const controller = createPortTestController({ midiInputFactory: factory })
    const onEvent = vi.fn()
    controller.start({
      portNames: REAL_PORT_NAMES,
      alreadyOpen: [{ index: 0, name: REAL_PORT_NAMES[0] }],
      onEvent,
    })
    expect(factory.instances).toHaveLength(2) // idx 1 und 2 wurden temporaer geoeffnet, idx 0 nicht

    controller.forwardMessage(0, REAL_PORT_NAMES[0], [0x90, 40, 100])

    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent.mock.calls[0][0].portIndex).toBe(0)
  })

  it('does not forward while inactive', () => {
    const factory = makeFakeInputFactory()
    const controller = createPortTestController({ midiInputFactory: factory })
    const onEvent = vi.fn()
    controller.forwardMessage(0, 'Akai MPD24 [2]', [0x90, 40, 100])
    expect(onEvent).not.toHaveBeenCalled()
  })

  it('stop() closes only the temporarily opened ports and their listeners', () => {
    const factory = makeFakeInputFactory()
    const controller = createPortTestController({ midiInputFactory: factory })
    controller.start({ portNames: REAL_PORT_NAMES, alreadyOpen: [], onEvent: () => {} })
    expect(controller.isActive()).toBe(true)

    controller.stop()

    expect(controller.isActive()).toBe(false)
    for (const inst of factory.instances) {
      expect(inst.closed).toBe(true)
      expect(inst.listeners).toHaveLength(0)
    }
  })

  it('repeated stop() is idempotent and safe', () => {
    const factory = makeFakeInputFactory()
    const controller = createPortTestController({ midiInputFactory: factory })
    controller.start({ portNames: REAL_PORT_NAMES, alreadyOpen: [], onEvent: () => {} })

    expect(() => {
      controller.stop()
      controller.stop()
      controller.stop()
    }).not.toThrow()
    expect(controller.isActive()).toBe(false)
  })

  it('repeated start() while active does not open a second set of temporary ports', () => {
    const factory = makeFakeInputFactory()
    const controller = createPortTestController({ midiInputFactory: factory })
    controller.start({ portNames: REAL_PORT_NAMES, alreadyOpen: [], onEvent: () => {} })
    const openedAfterFirstStart = factory.instances.length

    const second = controller.start({ portNames: REAL_PORT_NAMES, alreadyOpen: [], onEvent: () => {} })

    expect(second.alreadyRunning).toBe(true)
    expect(factory.instances.length).toBe(openedAfterFirstStart)
  })

  it('a port that fails to open does not crash the whole test', () => {
    const failingFactory = () => ({
      openPort() { throw new Error('device busy') },
      ignoreTypes() {},
      on() {},
      removeAllListeners() {},
      closePort() {},
    })
    const controller = createPortTestController({ midiInputFactory: failingFactory })
    const result = controller.start({ portNames: REAL_PORT_NAMES, alreadyOpen: [], onEvent: () => {} })
    expect(result.ok).toBe(true)
    expect(result.opened).toEqual([])
    expect(controller.isActive()).toBe(true)
  })
})
