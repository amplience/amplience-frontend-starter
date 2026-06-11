/**
 * The renderer's public surface (ADR-0010). Pages import `renderContent`
 * and pass it a content tree plus the deployment's registry; the failure
 * cards are exported for tests and Storybook.
 */

export { renderContent } from './dispatch'
export { emitContentFailure, emitRendererFailure } from './console'
export { ComponentUnregisteredCard } from './failure/ComponentUnregisteredCard'
export { ContentUnavailableCard } from './failure/ContentUnavailableCard'
export { FailureCard } from './failure/FailureCard'
export { PropsValidationFailureCard } from './failure/PropsValidationFailureCard'
export { SchemaUnknownCard } from './failure/SchemaUnknownCard'
