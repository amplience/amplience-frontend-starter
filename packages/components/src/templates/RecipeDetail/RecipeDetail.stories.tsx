import type { Meta, StoryObj } from '@storybook/react'

import { RecipeDetail } from './RecipeDetail'
import type { RecipeDetailProps } from './RecipeDetail'

const meta = {
  title: 'Templates/RecipeDetail',
  component: RecipeDetail,
  tags: ['autodocs'],
  parameters: {
    controls: { disable: true },
    layout: 'fullscreen',
  },
} satisfies Meta<typeof RecipeDetail>

export default meta
type Story = StoryObj<typeof RecipeDetail>

const full: RecipeDetailProps = {
  title: 'Slow-roast tomato and white bean soup',
  subtitle: 'A hearty winter soup that holds well on the pass and finishes in two minutes.',
  serves: 6,
  heroImage: {
    mediaType: 'ManualImage',
    image: {
      src: 'https://picsum.photos/seed/ql-recipe/1600/900',
      alt: 'A bowl of tomato and white bean soup',
      width: 1600,
      height: 900,
    },
  },
  intro:
    'Roasting the tomatoes first gives this soup a **deep, sweet base** — a small step that makes a big difference at service.',
  ingredients: [
    { name: 'Plum tomatoes, halved', quantity: '1.2kg', portion: '1 x Case' },
    { name: 'Cannellini beans, drained', quantity: '800g', productCode: '100234' },
    { name: 'Vegetable stock', quantity: '1.5l', productCode: '100871' },
    { name: 'Garlic cloves', quantity: '6' },
    { name: 'Extra virgin olive oil', quantity: '60ml' },
    { name: 'Fresh basil, to finish' },
  ],
  preparation:
    'Halve the tomatoes and **peel the garlic** before you start. Drain and rinse the beans.',
  methodSteps: [
    'Heat the oven to 180°C. Toss the tomatoes and garlic in the oil and roast for 40 minutes.',
    'Tip the roasted tomatoes, garlic and any juices into a pan with the stock and beans.',
    'Simmer for 15 minutes, then blend half the soup and stir it back in.',
    'Season, and finish with torn basil.',
  ],
  methodNotes: 'NB: the soup thickens on standing — loosen with a little stock when reheating.',
  allergens: ['Celery'],
  nutrition: {
    kcalPer100g: 62,
    portionWeightG: 380,
    portionKcal: 236,
    carbsPercent: 48,
    proteinPercent: 17,
    fatPercent: 35,
  },
  recipePdfUrl: 'https://example.com/recipe.pdf',
}

const { heroImage: _heroImage, ...withoutImage } = full
const { allergens: _allergens, nutrition: _nutrition, ...withoutAllergensOrNutrition } = full

export const Playground: Story = {
  parameters: { controls: { disable: false } },
  args: full,
}

export const Complete: Story = {
  name: 'Complete recipe',
  args: full,
}

export const AiEnhancedImage: Story = {
  name: 'AI-enhanced image — labelled',
  args: { ...full, imageIsAiEnhanced: true },
}

export const NoImage: Story = {
  name: 'No image — text-only hero',
  args: withoutImage,
}

export const MinimalRequired: Story = {
  name: 'Only the required fields',
  args: {
    title: 'Plain roast potatoes',
    ingredients: [{ name: 'Potatoes' }, { name: 'Oil' }],
    methodSteps: ['Roast until golden.'],
  },
}

export const NoNutritionOrAllergens: Story = {
  name: 'No allergens or nutrition — sections omitted',
  args: withoutAllergensOrNutrition,
}
