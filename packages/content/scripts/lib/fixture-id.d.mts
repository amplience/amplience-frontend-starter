// Hand-written declarations for the id helper, which stays plain ESM (.mjs) so
// the generator and stamper scripts can import it without a TS loader. This
// lets the .ts guard test and typecheck see real types for the import.

/** SHA-1 seeded, shaped as a v5 UUID. Not a true v5 — the namespace is the seed. */
export declare const uuidFrom: (seed: string) => string

/** The id for a fixture, from its set name and its path within that set. */
export declare const fixtureIdFor: (setName: string, relPath: string) => string
