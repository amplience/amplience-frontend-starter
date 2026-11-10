import { beforeEach, describe, expect, it, vi } from 'vitest'

const { preview, sdkGetByKey, makeSdk } = vi.hoisted(() => {
  const sdkGetByKey = vi.fn()
  return {
    preview: { host: undefined as string | undefined },
    sdkGetByKey,
    makeSdk: vi.fn(() => ({
      getByKey: sdkGetByKey,
      getById: vi.fn(),
      listBySchema: vi.fn(),
      getHierarchy: vi.fn(),
    })),
  }
})

vi.mock('./preview-request', () => ({ getPreviewHost: () => Promise.resolve(preview.host) }))
vi.mock('@amplience/frontend-starter-content/sdk', () => ({ makeSdkContentClient: makeSdk }))

// No CONTENT_CLIENT in tests, so `liveClient` is the fixture mock.
const { client, liveClient } = await import('./content-client')

const HOST = 'abc-gvzrfgnzc-1794568891000.staging.bigcontent.io'

beforeEach(() => {
  preview.host = undefined
  sdkGetByKey.mockReset()
  makeSdk.mockClear()
})

describe('content client', () => {
  it('reads through the live client outside a preview', async () => {
    const live = vi.spyOn(liveClient, 'getByKey').mockResolvedValue({ live: true } as never)
    expect(await client.getByKey('site/home')).toEqual({ live: true })
    expect(live).toHaveBeenCalledWith('site/home', undefined)
    expect(makeSdk).not.toHaveBeenCalled()
    live.mockRestore()
  })

  it('reads through a client pinned to the preview host inside a preview', async () => {
    preview.host = HOST
    sdkGetByKey.mockResolvedValue({ preview: true })
    const opts = { depth: 'all' as const }
    expect(await client.getByKey('site/home', opts)).toEqual({ preview: true })
    expect(sdkGetByKey).toHaveBeenCalledWith('site/home', opts)
    expect(makeSdk).toHaveBeenCalledWith(expect.objectContaining({ stagingHost: HOST }))
  })
})
