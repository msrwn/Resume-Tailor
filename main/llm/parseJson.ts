/**
 * Parse JSON from LLM response. Strips leading/trailing non-JSON (e.g. markdown code blocks).
 */
const JSON_BLOCK_REGEX = /```(?:json)?\s*([\s\S]*?)```/;

export function parseStrictJson<T = unknown>(raw: string): { success: true; data: T } | { success: false; error: string } {
  let text = raw.trim();

  // Try to extract from markdown code block
  const blockMatch = text.match(JSON_BLOCK_REGEX);
  if (blockMatch) {
    text = blockMatch[1].trim();
  }

  // Trim to first { and last }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return { success: false, error: 'No JSON object found in response' };
  }
  text = text.substring(firstBrace, lastBrace + 1);

  try {
    const data = JSON.parse(text) as T;
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'JSON parse error' };
  }
}
