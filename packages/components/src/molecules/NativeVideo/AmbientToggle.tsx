import clsx from 'clsx'

import { Icon } from '../../atoms/Icon/Icon'
import styles from './AmbientToggle.module.css'

export type AmbientToggleProps = {
  /** Decides the icon and label. */
  paused: boolean
  onToggle: () => void
  className?: string
}

/** Pause/play for autoplaying ambient video (WCAG 2.2.2). `data-ambient-toggle` is a HeroBlock hook. */
export function AmbientToggle({ paused, onToggle, className }: AmbientToggleProps) {
  return (
    <button
      type="button"
      className={clsx(styles.toggle, className)}
      aria-label={paused ? 'Play background video' : 'Pause background video'}
      data-ambient-toggle=""
      onClick={onToggle}
    >
      <Icon name={paused ? 'play' : 'pause'} size={18} />
    </button>
  )
}
