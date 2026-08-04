/**
 * Shared between the registry model and the canvas store. Lives on its own so
 * `lib/library/*` can name an untitled canvas without importing the store (and
 * the store re-exports it, so existing callers are unaffected).
 */
export const DEFAULT_MAP_NAME = "Untitled map";
