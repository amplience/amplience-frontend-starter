import clsx from 'clsx'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CreditCard,
  Eye,
  Filter,
  Heart,
  Info,
  LayoutGrid,
  List,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  Minus,
  Package,
  Plus,
  Search,
  Share2,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Star,
  Tag,
  Trash2,
  Truck,
  User,
  X,
} from 'lucide-react'

import styles from './Icon.module.css'

// ---------------------------------------------------------------------------
// Icon registry
//
// This map is the single place where icons are added to or removed from
// the design system. Only icons in this map are bundled — tree-shaking
// eliminates anything not referenced here. Lucide is an implementation
// detail; callers never import from lucide-react directly.
//
// Naming convention: kebab-case, matching Lucide's own naming so the
// mapping is obvious. To add a new icon:
//   1. Import it from 'lucide-react' above.
//   2. Add an entry to the map below.
//   3. The IconName type updates automatically.
// ---------------------------------------------------------------------------

const icons = {
  // Navigation & UI
  menu: Menu,
  x: X,
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  search: Search,
  filter: Filter,
  sliders: SlidersHorizontal,
  'layout-grid': LayoutGrid,
  list: List,
  eye: Eye,
  plus: Plus,
  minus: Minus,
  // User & account
  user: User,
  'log-in': LogIn,
  'log-out': LogOut,
  // Commerce
  'shopping-cart': ShoppingCart,
  'shopping-bag': ShoppingBag,
  heart: Heart,
  tag: Tag,
  'credit-card': CreditCard,
  package: Package,
  truck: Truck,
  'map-pin': MapPin,
  trash: Trash2,
  share: Share2,
  // Feedback & status
  star: Star,
  check: Check,
  'check-circle': CheckCircle,
  'alert-circle': AlertCircle,
  info: Info,
} as const

export type IconName = keyof typeof icons
export const ICON_NAMES = Object.freeze(Object.keys(icons) as IconName[])

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IconSize = number | string

export type IconColor =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'black'
  | 'white'
  | 'success'
  | 'info'
  | 'warning'
  | 'error'

export type IconProps = {
  /**
   * Name of the icon to render. Must be a key from the design system's
   * curated icon set. To add new icons, update the registry in Icon.tsx.
   *
   * Usage: <Icon name="search" />
   */
  name: IconName
  /**
   * Size passed to the icon's `size` prop. Accepts any CSS length string or
   * a pixel number. Defaults to `"1em"` so the icon scales with the
   * surrounding text — e.g. alongside a Typography or inside a Button it
   * will match the current font-size automatically.
   *
   * Supply an explicit value (e.g. size={20} or size="1.5rem") when the
   * icon needs to be a fixed size regardless of context.
   */
  size?: IconSize
  /**
   * Optional colour token. When omitted the icon inherits `currentColor`
   * from its parent — the right default when the icon sits alongside text.
   *
   * When set, locally rebinds --icon-color to the corresponding brand token:
   *   "primary"   → var(--color-primary)
   *   "secondary" → var(--color-secondary)
   *   "tertiary"  → var(--color-tertiary)
   *   "black"     → var(--color-black)
   *   "white"     → var(--color-white)
   */
  color?: IconColor
  /**
   * Accessible label for screen readers. When omitted the icon is treated
   * as decorative (aria-hidden="true"). Always supply a label when the icon
   * conveys meaning that isn't expressed by adjacent visible text.
   */
  label?: string
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a named icon from the design system's curated Lucide-backed set.
 * Lucide is an implementation detail — callers use a name string, not a
 * component import, so the backing library can be swapped without touching
 * any call site.
 *
 * Sizing:   defaults to 1em — scales with surrounding text. Pass an explicit
 *           size prop to fix it independently of context.
 * Colour:   defaults to currentColor (inherits from parent). Pass
 *           color="primary" etc. to pin to a brand token.
 * A11y:     decorative without label (aria-hidden on wrapper); meaningful
 *           with label (role="img" + aria-label on wrapper, aria-hidden on SVG).
 *
 * Usage:
 *   <Icon name="search" label="Search" />
 *   <Icon name="shopping-cart" size={20} color="primary" />
 *   <Icon name="chevron-right" />   {/* decorative *\/}
 */
export function Icon({ name, size = '1em', color, label, className }: IconProps) {
  const IconComponent = icons[name]
  const isDecorative = !label

  return (
    <span
      className={clsx(styles.root, className)}
      role={isDecorative ? undefined : 'img'}
      aria-label={isDecorative ? undefined : label}
      aria-hidden={isDecorative ? 'true' : undefined}
      data-color={color}
    >
      <IconComponent size={size} color="currentColor" aria-hidden="true" />
    </span>
  )
}
