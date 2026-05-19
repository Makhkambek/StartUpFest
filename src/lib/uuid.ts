const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * RFC 4122 UUID format check. Used to validate `id` fields from JSON bodies
 * before they reach PostgREST string-DSL filters such as `.or()`, which would
 * otherwise allow filter-string injection (treat input as authoritative SQL,
 * not parameterized data).
 */
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}
