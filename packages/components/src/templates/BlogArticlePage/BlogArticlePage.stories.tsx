import type { Meta, StoryObj } from '@storybook/react'

import { storyBlogArticle } from '../../fixtures/blog-articles'
import { BlogArticlePage } from './BlogArticlePage'

const meta = {
  title: 'Templates/BlogArticlePage',
  component: BlogArticlePage,
  tags: ['autodocs'],
  parameters: {
    controls: { disable: true },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof BlogArticlePage>

export default meta
type Story = StoryObj<typeof BlogArticlePage>

/** A fixture article as the template's props — the slug is the story's, not the template's. */
const fromFixture = (slug: string) => {
  const { slug: _slug, ...props } = storyBlogArticle(slug)
  return props
}

/**
 * Stands in for the rendered slots — the real route passes the renderer's
 * output for the article's `slots` array, which can hold any registered block.
 */
const Body = () => (
  <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '2rem 1rem' }}>
    <h2>Why a starter, not a framework</h2>
    <p>
      Everything here is yours to change. The starter gives you a working content model, a renderer
      and a set of components — then gets out of the way.
    </p>
    <p>
      Each block an editor adds to the article body arrives here in order, rendered by the same
      registry as every other page.
    </p>
  </div>
)

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: fromFixture('getting-started'),
  render: (args) => (
    <BlogArticlePage {...args}>
      <Body />
    </BlogArticlePage>
  ),
}

export const Editorial: Story = {
  name: 'Editorial (Anya Finn)',
  args: { ...fromFixture('grown-up-glitter'), loadPriority: 'lcp' },
  render: (args) => (
    <BlogArticlePage {...args}>
      <Body />
    </BlogArticlePage>
  ),
}

export const HeaderOnly: Story = {
  name: 'Header only — no body slots',
  args: fromFixture('content-modelling'),
}

export const NoCoverImage: Story = {
  name: 'No cover image',
  args: (({ coverImage: _cover, ...rest }) => rest)(fromFixture('quadratic-accelerator')),
}

export const Minimal: Story = {
  name: 'Title only — no metadata bar content',
  args: { title: 'A note with nothing else' },
}

export const LongTitle: Story = {
  name: 'Long title and many tags',
  args: {
    ...fromFixture('piratecore'),
    title:
      'Piratecore, revisited: ruffles, brocade and the return of the statement boot this winter',
    tags: ['shop-the-look', 'autumn-winter', 'footwear', 'outerwear', 'statement', 'vintage'],
  },
}
