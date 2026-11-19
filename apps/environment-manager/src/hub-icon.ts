/** An icon is an image when it is an http(s) URL; otherwise it renders as text (an emoji). */
export const isImageIcon = (icon: string): boolean => /^https?:\/\/\S+$/i.test(icon.trim())
