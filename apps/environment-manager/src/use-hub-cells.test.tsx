// @vitest-environment jsdom
//
// The hook that reads every hub separately.
//
// Two of its properties are the whole reason the grid fills progressively, and
// both are invisible when they break: columns must not wait for each other,
// and refreshing one column must not cancel the others. A regression in either
// shows up as a column that silently never fills, which is about the hardest
// thing to notice in a fourteen-column grid.

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useHubCells } from './use-hub-cells.js'

afterEach(cleanup)

/** Let any already-resolved promises settle before asserting. */
const flush = () => Promise.resolve()

/** A promise plus the handles to settle it, so a test controls the timing. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Renders each hub's status as text, so assertions read like the grid does. */
function Probe({
  hubs,
  read,
  onRefresh,
}: {
  hubs: string[]
  read: (hub: string) => Promise<string>
  onRefresh?: (refresh: (names?: readonly string[]) => void) => void
}) {
  const { reads, refresh } = useHubCells(hubs, read)
  onRefresh?.(refresh)
  return (
    <ul>
      {hubs.map((hub) => {
        const entry = reads[hub]
        const text =
          entry === undefined || entry.status === 'reading'
            ? 'reading'
            : entry.status === 'ok'
              ? entry.data
              : `failed: ${entry.error}`
        return <li key={hub}>{`${hub}=${text}`}</li>
      })}
    </ul>
  )
}

describe('useHubCells', () => {
  // ⚠️ The point of the hook. One slow hub used to decide when the whole grid
  // appeared; now it decides only when its own column does.
  it('lets a fast hub finish while a slow one is still outstanding', async () => {
    const slow = deferred<string>()
    const read = (hub: string) => (hub === 'slow' ? slow.promise : Promise.resolve('quick'))

    render(<Probe hubs={['fast', 'slow']} read={read} />)
    expect(await screen.findByText('fast=quick')).toBeDefined()
    expect(screen.getByText('slow=reading')).toBeDefined()

    await act(async () => {
      slow.resolve('eventually')
      await slow.promise
    })
    expect(screen.getByText('slow=eventually')).toBeDefined()
  })

  it('starts every hub reading, and reads each exactly once', async () => {
    const read = vi.fn((hub: string) => Promise.resolve(hub.toUpperCase()))
    render(<Probe hubs={['a', 'b', 'c']} read={read} />)
    expect(await screen.findByText('a=A')).toBeDefined()
    expect(read).toHaveBeenCalledTimes(3)
  })

  it('reports a rejected read without losing the message', async () => {
    const read = (hub: string) =>
      hub === 'bad' ? Promise.reject(new Error('denied')) : Promise.resolve('fine')
    render(<Probe hubs={['bad', 'good']} read={read} />)
    expect(await screen.findByText('bad=failed: denied')).toBeDefined()
    expect(screen.getByText('good=fine')).toBeDefined()
  })

  it('still reports something when the rejection is not an Error', async () => {
    // ⚠️ Cast, not a real Error: the branch under test is the one that fires
    // when something rejects with a value that is *not* an Error, which the
    // lint rule would otherwise forbid writing down.
    const notAnError = 'just a string' as unknown as Error
    render(<Probe hubs={['odd']} read={() => Promise.reject(notAnError)} />)
    expect(await screen.findByText(/odd=failed:/)).toBeDefined()
  })

  describe('refresh', () => {
    it('re-reads only the hubs it is given', async () => {
      const read = vi.fn((hub: string) => Promise.resolve(`${hub}-read`))
      let refresh!: (names?: readonly string[]) => void
      render(<Probe hubs={['a', 'b']} read={read} onRefresh={(fn) => (refresh = fn)} />)
      expect(await screen.findByText('a=a-read')).toBeDefined()
      expect(read).toHaveBeenCalledTimes(2)

      await act(async () => {
        refresh(['a'])
        await flush()
      })
      expect(read).toHaveBeenCalledTimes(3)
      expect(read).toHaveBeenLastCalledWith('a')
    })

    it('re-reads the whole fleet when given nothing', async () => {
      const read = vi.fn((hub: string) => Promise.resolve(`${hub}-read`))
      let refresh!: (names?: readonly string[]) => void
      render(<Probe hubs={['a', 'b']} read={read} onRefresh={(fn) => (refresh = fn)} />)
      expect(await screen.findByText('a=a-read')).toBeDefined()

      await act(async () => {
        refresh()
        await flush()
      })
      expect(read).toHaveBeenCalledTimes(4)
    })

    // ⚠️ The reason the sequence number is per hub rather than one counter for
    // the hook. A single counter would make refreshing one column discard
    // every other column's in-flight answer, and those columns would just
    // never fill.
    it('does not discard another hub’s answer that is still in flight', async () => {
      const slow = deferred<string>()
      const read = vi.fn((hub: string) =>
        hub === 'slow' ? slow.promise : Promise.resolve('quick'),
      )
      let refresh!: (names?: readonly string[]) => void
      render(<Probe hubs={['slow', 'fast']} read={read} onRefresh={(fn) => (refresh = fn)} />)
      expect(await screen.findByText('fast=quick')).toBeDefined()

      await act(async () => {
        refresh(['fast'])
        await flush()
      })
      await act(async () => {
        slow.resolve('arrived late')
        await slow.promise
      })
      expect(screen.getByText('slow=arrived late')).toBeDefined()
    })

    // An answer from a superseded read of the *same* hub is dropped, so a
    // refresh cannot be overwritten by the request it replaced.
    it('ignores a stale answer for a hub that has been re-read', async () => {
      const first = deferred<string>()
      const calls: number[] = []
      let n = 0
      const read = () => {
        calls.push(++n)
        return n === 1 ? first.promise : Promise.resolve('second')
      }
      let refresh!: (names?: readonly string[]) => void
      render(<Probe hubs={['a']} read={read} onRefresh={(fn) => (refresh = fn)} />)

      await act(async () => {
        refresh(['a'])
        await flush()
      })
      expect(await screen.findByText('a=second')).toBeDefined()

      await act(async () => {
        first.resolve('first, too late')
        await first.promise
      })
      expect(screen.getByText('a=second')).toBeDefined()
    })
  })

  it('reads a hub that appears later without re-reading the others', async () => {
    const read = vi.fn((hub: string) => Promise.resolve(`${hub}-read`))
    const { rerender } = render(<Probe hubs={['a']} read={read} />)
    expect(await screen.findByText('a=a-read')).toBeDefined()
    expect(read).toHaveBeenCalledTimes(1)

    rerender(<Probe hubs={['a', 'b']} read={read} />)
    expect(await screen.findByText('b=b-read')).toBeDefined()
  })

  // The hub list is a fresh array on every render of the parent. Depending on
  // its identity would re-read the fleet on every keystroke in the filter box.
  it('does not re-read when the same hubs arrive as a new array', async () => {
    const read = vi.fn((hub: string) => Promise.resolve(`${hub}-read`))
    const { rerender } = render(<Probe hubs={['a', 'b']} read={read} />)
    expect(await screen.findByText('a=a-read')).toBeDefined()
    expect(read).toHaveBeenCalledTimes(2)

    rerender(<Probe hubs={['a', 'b']} read={read} />)
    rerender(<Probe hubs={['a', 'b']} read={read} />)
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('does nothing at all with no hubs', () => {
    const read = vi.fn(() => Promise.resolve('x'))
    const { container } = render(<Probe hubs={[]} read={read} />)
    expect(read).not.toHaveBeenCalled()
    expect(container.querySelectorAll('li')).toHaveLength(0)
  })
})
