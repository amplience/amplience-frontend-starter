// Type shim for CSS Modules.
// Without this, TypeScript doesn't know the shape of `import styles from '*.module.css'`.
declare module '*.module.css' {
  const styles: Readonly<Record<string, string>>
  export default styles
}
