/**
 * Text going INTO a PostgREST filter string -- .or() / .and() -- must be
 * quoted. Unquoted, it is read as filter syntax: a comma starts a new
 * condition, a parenthesis opens or closes a group, a dot splits
 * column.operator.value. A search for "Ch. 5 (revision), part 2" then errors
 * or quietly means something other than what the student typed.
 *
 * Inside double quotes PostgREST takes everything as one value, and a
 * backslash takes the next character literally (pQuotedValue in PostgREST's
 * QueryParams.hs, which .or() values go through via pLogicSingleVal; checked
 * 2026-10-06).
 */
export function pgrstValue(value) {
  return '"' + String(value ?? '').replace(/[\\"]/g, '\\$&') + '"'
}

/**
 * An ILIKE "contains" pattern for user text, quoted for a filter string.
 * % and _ are LIKE wildcards, so they are escaped as well: searching "100%"
 * finds "100%", not every note that merely starts with "100".
 */
export function ilikeContains(text) {
  return pgrstValue('%' + String(text ?? '').replace(/[\\%_]/g, '\\$&') + '%')
}
