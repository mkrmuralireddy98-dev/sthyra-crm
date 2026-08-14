/**
 * Storage tiering — pure function for S3 storage class selection.
 *
 * Per plan.md §NFR-6 Storage Tiering:
 *   raw 360°:  Standard → IA → Glacier
 *     - 0–30 days:   Standard (hot, frequently accessed)
 *     - 30–90 days:  Standard-IA (infrequent)
 *     - 365+ days:   Glacier (cold archive)
 *   artifacts:  Standard → IA → Glacier Deep Archive
 *     - 0–90 days:   Standard (recent captures)
 *     - 90–365 days: Standard-IA (still relevant for review)
 *     - 365+ days:   Glacier Deep Archive (compliance retention)
 *
 * The function does NOT distinguish raw vs artifacts — that's a per-call
 * decision. The defaults here match the **raw** lifecycle (which is the
 * more aggressive tiering). Artifacts can pass a longer "hot" window
 * via a future option.
 *
 * IMPORTANT: this function is pure. It does not call Date.now() —
 * the caller provides the age. This makes it trivially testable.
 */

export const StorageClass = {
 STANDARD: 'STANDARD',
 STANDARD_IA: 'STANDARD_IA',
 GLACIER: 'GLACIER',
 GLACIER_DEEP_ARCHIVE: 'DEEP_ARCHIVE',
} as const;
export type StorageClass = (typeof StorageClass)[keyof typeof StorageClass];

/**
 * Boundary constants (in days). Useful for documentation, SLOs, and
 * the lifecycle hook that triggers tier transitions.
 */
export const TIER_BOUNDARIES_DAYS = {
 /** Day 0 → day 30: Standard (hot). */
 STANDARD_TO_IA: 30,
 /** Day 30 → day 90 (raw) / day 90 (artifacts): Standard-IA. */
 IA_TO_GLACIER: 90,
 /** Day 90 → day 365 (artifacts) / day 365+ (raw): Glacier / Deep Archive. */
 GLACIER_TO_DEEP_ARCHIVE: 365,
} as const;

/**
 * Returns the appropriate S3 storage class for an object of the given
 * age. Age is in milliseconds (consistent with Date.getTime() output).
 *
 * Boundary semantics: at exactly the boundary day, the object has
 * ALREADY transitioned. tierFor(days(30)) returns STANDARD_IA, not
 * STANDARD — the transition happened at the start of day 30.
 */
export function tierFor(ageMs: number): StorageClass {
 if (ageMs < 0) return StorageClass.STANDARD;
 if (ageMs < TIER_BOUNDARIES_DAYS.STANDARD_TO_IA * 24 * 60 * 60 * 1000) {
 return StorageClass.STANDARD;
 }
 if (ageMs < TIER_BOUNDARIES_DAYS.IA_TO_GLACIER * 24 * 60 * 60 * 1000) {
 return StorageClass.STANDARD_IA;
 }
 if (ageMs < TIER_BOUNDARIES_DAYS.GLACIER_TO_DEEP_ARCHIVE * 24 * 60 * 60 * 1000) {
 return StorageClass.STANDARD_IA; // raw artifacts are still IA until 365
 }
 return StorageClass.GLACIER;
}
