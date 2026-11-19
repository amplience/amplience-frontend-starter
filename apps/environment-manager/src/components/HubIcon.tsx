import { useState } from 'react'

import { isImageIcon } from '../hub-icon.js'

/** A hub's icon in a fixed box, so labels align whether it's an emoji, an image or absent. */
export function HubIcon({ icon }: { icon: string | undefined }) {
  const value = icon?.trim() ?? ''
  const [failed, setFailed] = useState<string | null>(null)
  if (value === '' || failed === value) return null

  return (
    <span className="hub-icon" aria-hidden="true">
      {isImageIcon(value) ? (
        <img src={value} alt="" referrerPolicy="no-referrer" onError={() => setFailed(value)} />
      ) : (
        value
      )}
    </span>
  )
}
