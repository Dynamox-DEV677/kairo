/**
 * Optional request shaping for /api/ai/chat, applied per model because Groq
 * rejects an option a model does not support with a 400 (llama has no
 * reasoning_effort at all).
 *
 *  - json: JSON mode, for callers that parse the reply. Groq's own compound
 *    systems are left out: they are the last resort, and a plain reply the
 *    caller parses leniently beats a 400.
 *  - effort: gpt-oss spends its reasoning tokens out of the same 2048 as the
 *    reply. A long study guide on "medium" can run out mid-object, so callers
 *    producing long structured output ask for "low".
 */
export function chatExtras(model, { json = false, effort } = {}) {
  const extras = {}
  const m = String(model || '')
  if (json === true && !/^groq\//.test(m)) extras.response_format = { type: 'json_object' }
  if (['low', 'medium', 'high'].includes(effort) && /^openai\/gpt-oss/.test(m)) extras.reasoning_effort = effort
  return extras
}
