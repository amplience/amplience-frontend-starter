// @vitest-environment jsdom
//
// Tests for the RecipeDetail template: which sections appear for which data,
// that allergen and nutrition values render exactly as supplied, and that the
// JSON-LD script cannot be broken out of.

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RecipeDetail } from './RecipeDetail'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentPropsWithoutRef<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: React.ComponentPropsWithoutRef<'img'>) => (
    <img src={src} alt={alt} {...props} />
  ),
}))

afterEach(cleanup)

const heroImage = {
  mediaType: 'ManualImage' as const,
  image: { src: '/soup.jpg', alt: 'A bowl of soup', width: 1600, height: 900 },
}

describe('RecipeDetail', () => {
  it('renders the title and the hero image', () => {
    render(<RecipeDetail title="Tomato soup" heroImage={heroImage} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Tomato soup' })).toBeTruthy()
    expect(screen.getByAltText('A bowl of soup')).toBeTruthy()
  })

  it('omits every optional section when the item carries no data for it', () => {
    const { container } = render(<RecipeDetail title="Bare" />)
    for (const attr of [
      'recipe-ingredients',
      'recipe-method',
      'recipe-nutrition',
      'recipe-notes',
      'recipe-preparation',
      'recipe-intro',
      'recipe-summary',
    ]) {
      expect(container.querySelector(`[data-${attr}]`), attr).toBeNull()
    }
  })

  it('lists ingredients with quantity, portion and product code', () => {
    render(
      <RecipeDetail
        title="r"
        ingredients={[
          { name: 'Plum tomatoes', quantity: '280g', portion: '1 x Each', productCode: '100234' },
          { name: 'Salt' },
        ]}
      />,
    )
    expect(screen.getByText('280g')).toBeTruthy()
    expect(screen.getByText('1 x Each · Code 100234')).toBeTruthy()
    expect(screen.getByText('Salt')).toBeTruthy()
  })

  it('renders method steps as an ordered list, in order', () => {
    const { container } = render(<RecipeDetail title="r" methodSteps={['First', 'Second']} />)
    const items = [...container.querySelectorAll('ol > li')].map((li) => li.textContent)
    expect(items).toEqual(['First', 'Second'])
  })

  it('shows allergens verbatim as a Contains row in the facts list', () => {
    const { container } = render(
      <RecipeDetail title="r" allergens={['Soya', 'Sulphur dioxide and sulphites']} />,
    )
    const row = [...container.querySelectorAll('dl > div')].find(
      (r) => r.querySelector('dt')?.textContent === 'Contains',
    )
    expect(row?.querySelector('dd')?.textContent).toBe('Soya, Sulphur dioxide and sulphites')
  })

  it('has no Contains row when there are no allergens', () => {
    render(<RecipeDetail title="r" serves={2} />)
    expect(screen.queryByText('Contains')).toBeNull()
  })

  it('puts preparation immediately before the method in the same column', () => {
    const { container } = render(
      <RecipeDetail title="r" preparation="Prep first" methodSteps={['Step one']} />,
    )
    const column = container.querySelector('[data-recipe-preparation]')?.parentElement
    expect(column?.querySelector('[data-recipe-method]')).not.toBeNull()
    expect(column?.firstElementChild?.hasAttribute('data-recipe-preparation')).toBe(true)
    expect(column?.children[1]?.hasAttribute('data-recipe-method')).toBe(true)
  })

  it('shows serves and portion figures, and nutrition values as supplied', () => {
    render(
      <RecipeDetail
        title="r"
        serves={4}
        nutrition={{
          kcalPer100g: 147,
          portionKcal: 719,
          portionWeightG: 475,
          carbsPercent: 30,
          proteinPercent: 40,
          fatPercent: 30,
        }}
      />,
    )
    expect(screen.getByText('719 kcal')).toBeTruthy()
    expect(screen.getByText('475g')).toBeTruthy()
    expect(screen.getByText('147kcal/100g')).toBeTruthy()
    expect(screen.getByText(/Protein 40%/)).toBeTruthy()
  })

  it('omits the nutrition section when every figure is absent', () => {
    const { container } = render(<RecipeDetail title="r" nutrition={{}} />)
    expect(container.querySelector('[data-recipe-nutrition]')).toBeNull()
  })

  it('labels an AI-enhanced image, and only then', () => {
    const { rerender } = render(<RecipeDetail title="r" imageIsAiEnhanced />)
    expect(screen.getByText('Image enhanced with AI')).toBeTruthy()
    rerender(<RecipeDetail title="r" imageIsAiEnhanced={false} />)
    expect(screen.queryByText('Image enhanced with AI')).toBeNull()
  })

  it('links the recipe PDF when one exists', () => {
    render(<RecipeDetail title="r" recipePdfUrl="https://example.com/r.pdf" />)
    const link = screen.getByText('Download recipe card (PDF)').closest('a')
    expect(link?.getAttribute('href')).toBe('https://example.com/r.pdf')
    expect(link?.getAttribute('data-color')).toBe('white')
    expect(link?.getAttribute('data-variant')).toBe('solid')
    // The CTA lives in the hero, not the summary band.
    expect(link?.closest('[data-recipe-summary]')).toBeNull()
  })

  it('renders markdown for the intro and chef notes', () => {
    render(<RecipeDetail title="r" intro="A **bold** claim" methodNotes="NB: *rest* it" />)
    expect(screen.getByText('bold').tagName).toBe('STRONG')
    expect(screen.getByText('rest').tagName).toBe('EM')
  })

  describe('JSON-LD', () => {
    it('emits the supplied data as a ld+json script', () => {
      const { container } = render(<RecipeDetail title="r" jsonLd={{ '@type': 'Recipe' }} />)
      const script = container.querySelector('script[type="application/ld+json"]')
      expect(JSON.parse(script?.textContent ?? '')).toEqual({ '@type': 'Recipe' })
    })

    it('escapes < so content cannot close the script early', () => {
      const { container } = render(
        <RecipeDetail title="r" jsonLd={{ name: '</script><b>x</b>' }} />,
      )
      const script = container.querySelector('script[type="application/ld+json"]')
      expect(script?.innerHTML).not.toContain('</script>')
      expect((JSON.parse(script?.textContent ?? '') as { name: string }).name).toBe(
        '</script><b>x</b>',
      )
    })

    it('emits none when no data is supplied', () => {
      const { container } = render(<RecipeDetail title="r" />)
      expect(container.querySelector('script[type="application/ld+json"]')).toBeNull()
    })
  })
})
