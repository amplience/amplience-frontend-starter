import { describe, expect, it } from 'vitest'

import {
  embedUrl,
  isPlayingMessage,
  parseVideoUrl,
  playerCommand,
  playerSubscribeMessages,
  youTubeThumbnailUrl,
} from './parse-video-url'

describe('parseVideoUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', { provider: 'youtube', id: 'dQw4w9WgXcQ' }],
    [
      'https://youtube.com/watch?v=dQw4w9WgXcQ&list=PL1',
      { provider: 'youtube', id: 'dQw4w9WgXcQ' },
    ],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', { provider: 'youtube', id: 'dQw4w9WgXcQ' }],
    ['https://youtu.be/dQw4w9WgXcQ', { provider: 'youtube', id: 'dQw4w9WgXcQ' }],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', { provider: 'youtube', id: 'dQw4w9WgXcQ' }],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', { provider: 'youtube', id: 'dQw4w9WgXcQ' }],
    [
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      { provider: 'youtube', id: 'dQw4w9WgXcQ' },
    ],
    ['https://youtu.be/dQw4w9WgXcQ?t=90', { provider: 'youtube', id: 'dQw4w9WgXcQ', start: 90 }],
    [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s',
      { provider: 'youtube', id: 'dQw4w9WgXcQ', start: 90 },
    ],
    ['https://vimeo.com/76979871', { provider: 'vimeo', id: '76979871' }],
    [
      'https://vimeo.com/76979871/abc123ef',
      { provider: 'vimeo', id: '76979871', hash: 'abc123ef' },
    ],
    ['https://vimeo.com/channels/staffpicks/76979871', { provider: 'vimeo', id: '76979871' }],
    ['https://player.vimeo.com/video/76979871', { provider: 'vimeo', id: '76979871' }],
    ['https://vimeo.com/showcase/123/video/456', { provider: 'vimeo', id: '456' }],
    [
      'https://player.vimeo.com/video/76979871?h=abc123ef',
      { provider: 'vimeo', id: '76979871', hash: 'abc123ef' },
    ],
    [
      'https://cdn.example.com/loops/waves.mp4',
      { provider: 'file', src: 'https://cdn.example.com/loops/waves.mp4' },
    ],
    [
      '  https://cdn.example.com/loops/WAVES.MP4?v=2  ',
      { provider: 'file', src: 'https://cdn.example.com/loops/WAVES.MP4?v=2' },
    ],
  ])('parses %s', (url, expected) => {
    expect(parseVideoUrl(url)).toEqual(expected)
  })

  it.each([
    undefined,
    '',
    'not a url',
    'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/channel/UC123',
    'https://www.youtube.com/embed/videoseries?list=PL1234567890',
    'https://vimeo.com/about',
    'https://example.com/video.mov',
    'https://example.com/watch?file=clip.mp4',
  ])('rejects %s', (url) => {
    expect(parseVideoUrl(url)).toBeUndefined()
  })
})

describe('embedUrl', () => {
  const youtube = { provider: 'youtube', id: 'dQw4w9WgXcQ' } as const
  const vimeo = { provider: 'vimeo', id: '76979871', hash: 'abc' } as const

  it('embeds YouTube players from youtube.com, autoplaying once pressed', () => {
    const url = new URL(embedUrl({ ...youtube, start: 30 }, 'player'))
    expect(url.origin + url.pathname).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
    expect(url.searchParams.get('autoplay')).toBe('1')
    expect(url.searchParams.get('mute')).toBeNull()
    expect(url.searchParams.get('start')).toBe('30')
  })

  it('makes an ambient YouTube embed muted, looping (via playlist) and control-less', () => {
    const url = new URL(embedUrl(youtube, 'ambient'))
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      autoplay: '1',
      mute: '1',
      loop: '1',
      playlist: 'dQw4w9WgXcQ',
      controls: '0',
      enablejsapi: '1',
    })
  })

  it('uses Vimeo background mode for ambient and keeps the privacy hash', () => {
    const ambient = new URL(embedUrl(vimeo, 'ambient'))
    expect(ambient.origin + ambient.pathname).toBe('https://player.vimeo.com/video/76979871')
    expect(ambient.searchParams.get('background')).toBe('1')
    expect(ambient.searchParams.get('h')).toBe('abc')
    expect(new URL(embedUrl(vimeo, 'player')).searchParams.get('autoplay')).toBe('1')
  })
})

describe('playerCommand', () => {
  it('speaks the YouTube iframe API to the youtube.com origin', () => {
    expect(playerCommand('youtube', 'pause')).toEqual({
      message: '{"event":"command","func":"pauseVideo","args":[]}',
      origin: 'https://www.youtube.com',
    })
    const { func } = JSON.parse(playerCommand('youtube', 'play').message) as { func: string }
    expect(func).toBe('playVideo')
  })

  it('speaks the Vimeo player API', () => {
    expect(playerCommand('vimeo', 'play')).toEqual({
      message: '{"method":"play"}',
      origin: 'https://player.vimeo.com',
    })
  })
})

it('builds the always-present hqdefault thumbnail', () => {
  expect(youTubeThumbnailUrl('dQw4w9WgXcQ')).toBe(
    'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  )
})

describe('playback-state messages', () => {
  it('asks YouTube to start reporting, and Vimeo for its playing events', () => {
    expect(playerSubscribeMessages('youtube')).toEqual([
      '{"event":"listening","id":1,"channel":"widget"}',
    ])
    expect(
      playerSubscribeMessages('vimeo').map((m) => (JSON.parse(m) as { value: string }).value),
    ).toEqual(['play', 'playing', 'timeupdate'])
  })

  it.each([
    ['{"event":"onStateChange","info":1}', true],
    ['{"event":"onStateChange","info":3}', false],
    ['{"event":"infoDelivery","info":{"playerState":1,"currentTime":2}}', true],
    ['{"event":"initialDelivery","info":{"playerState":-1}}', false],
    ['{"event":"onReady"}', false],
    ['not json', false],
  ])('YouTube %s → playing: %s', (data, playing) => {
    expect(isPlayingMessage('youtube', data)).toBe(playing)
  })

  it.each([
    ['{"event":"playing"}', true],
    ['{"event":"timeupdate","data":{"seconds":1}}', true],
    ['{"event":"ready"}', false],
    [{ event: 'play' }, true],
    [null, false],
  ])('Vimeo %o → playing: %s', (data, playing) => {
    expect(isPlayingMessage('vimeo', data)).toBe(playing)
  })
})
