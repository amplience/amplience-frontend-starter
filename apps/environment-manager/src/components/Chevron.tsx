type Props = {
  /** Whether the thing this chevron controls is currently expanded. */
  open: boolean
}

/**
 * Disclosure chevron shared by every expandable thing in the panel.
 *
 * Points down while collapsed and up while expanded. Down-when-closed is the
 * convention for "this opens in place"; a chevron pointing right reads as
 * "this navigates somewhere", which none of these do. One component so every
 * disclosure follows the same rule instead of each re-deciding the rotation.
 *
 * Decorative: the control carrying it exposes `aria-expanded`, which is what
 * assistive tech should announce.
 */
export function Chevron({ open }: Props) {
  return (
    <svg
      className={`chevron${open ? ' chevron--open' : ''}`}
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="2,4 6,8 10,4" />
    </svg>
  )
}
