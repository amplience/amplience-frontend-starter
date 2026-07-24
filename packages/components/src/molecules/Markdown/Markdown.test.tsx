// @vitest-environment jsdom
//
// Smoke tests for the Markdown molecule.

import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Markdown } from './Markdown'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentPropsWithoutRef<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

afterEach(cleanup)

describe('Markdown', () => {
  describe('inline formatting', () => {
    it('renders bold text', () => {
      render(<Markdown content="This is **bold** text." />)
      expect(document.querySelector('strong')).toBeTruthy()
      expect(document.querySelector('strong')?.textContent).toBe('bold')
    })

    it('renders italic text', () => {
      render(<Markdown content="This is _italic_ text." />)
      expect(document.querySelector('em')?.textContent).toBe('italic')
    })

    it('renders inline code', () => {
      render(<Markdown content="Use `const x = 1` here." />)
      expect(document.querySelector('code')?.textContent).toBe('const x = 1')
    })
  })

  describe('block elements', () => {
    it('renders a paragraph', () => {
      render(<Markdown content="Hello world." />)
      expect(document.querySelector('p')?.textContent).toBe('Hello world.')
    })

    it('renders headings at the correct level', () => {
      render(<Markdown content="## Section title" />)
      expect(screen.getByRole('heading', { level: 2, name: 'Section title' })).toBeTruthy()
    })

    it('renders an unordered list', () => {
      const { container } = render(<Markdown content={'- Item A\n- Item B'} />)
      const items = within(container).getAllByRole('listitem')
      expect(items).toHaveLength(2)
      expect(items[0]!.textContent).toBe('Item A')
    })

    it('renders an ordered list', () => {
      const { container } = render(<Markdown content={'1. First\n2. Second'} />)
      expect(container.querySelector('ol')).toBeTruthy()
      expect(within(container).getAllByRole('listitem')).toHaveLength(2)
    })

    it('renders a blockquote', () => {
      render(<Markdown content="> A wise quote." />)
      expect(document.querySelector('blockquote')).toBeTruthy()
    })

    it('renders a code block', () => {
      const { container } = render(<Markdown content={'```\nconst x = 1\n```'} />)
      expect(container.querySelector('pre')).toBeTruthy()
      expect(container.querySelector('pre code')).toBeTruthy()
    })
  })

  describe('links', () => {
    it('renders an internal link via the Link atom', () => {
      render(<Markdown content="Go to [about](/about)." />)
      const link = screen.getByRole('link', { name: 'about' })
      expect(link.getAttribute('href')).toBe('/about')
    })

    it('renders an external link via the Link atom', () => {
      render(<Markdown content="Visit [Amplience](https://amplience.com)." />)
      const link = screen.getByRole('link', { name: 'Amplience' })
      expect(link.getAttribute('href')).toBe('https://amplience.com')
    })
  })

  describe('GitHub Flavored Markdown (remark-gfm)', () => {
    it('renders a table with header and body cells', () => {
      const table = ['| Variable | Purpose |', '| --- | --- |', '| SITE_NAME | Namespace |'].join(
        '\n',
      )
      const { container } = render(<Markdown content={table} />)
      expect(container.querySelector('table')).toBeTruthy()
      expect(container.querySelector('th')?.textContent).toBe('Variable')
      const cells = container.querySelectorAll('td')
      expect(cells[0]?.textContent).toBe('SITE_NAME')
      expect(cells[1]?.textContent).toBe('Namespace')
    })

    it('renders strikethrough text', () => {
      render(<Markdown content="This is ~~struck~~ text." />)
      expect(document.querySelector('del')?.textContent).toBe('struck')
    })

    it('renders a task list with checkboxes', () => {
      const { container } = render(<Markdown content={'- [x] Done\n- [ ] Todo'} />)
      const boxes = container.querySelectorAll('input[type="checkbox"]')
      expect(boxes).toHaveLength(2)
      expect((boxes[0] as HTMLInputElement).checked).toBe(true)
      expect((boxes[1] as HTMLInputElement).checked).toBe(false)
    })

    it('autolinks a bare URL', () => {
      render(<Markdown content="See https://amplience.com for details." />)
      const link = screen.getByRole('link', { name: 'https://amplience.com' })
      expect(link.getAttribute('href')).toBe('https://amplience.com')
    })
  })

  describe('className', () => {
    it('forwards className to the root div', () => {
      const { container } = render(<Markdown content="Test" className="custom" />)
      expect(container.querySelector('.custom')).toBeTruthy()
    })
  })
})
