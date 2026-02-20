/**
 * Build a simple HTML wrapper for cover letter text.
 * Escapes user content for safe display. No user template (MVP).
 */
export function buildCoverLetterHtml(coverLetterText: string): string {
  const escaped = escapeHtml(coverLetterText);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Cover Letter</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; max-width: 700px; }
    p { margin-bottom: 1em; }
  </style>
</head>
<body>
<div class="cover-letter">
${escaped.split(/\n\n+/).map((p) => `  <p>${p.replace(/\n/g, '<br>')}</p>`).join('\n')}
</div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
