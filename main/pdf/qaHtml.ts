/**
 * Build a simple HTML wrapper for QA (Questions & Answers) content.
 * Escapes user content for safe display. Simple Q&A format.
 */
export function buildQAHtml(qa: Array<{ question: string; answer: string }>): string {
  if (!qa || qa.length === 0) {
    return '';
  }

  const qaItems = qa.map((item) => {
    const question = escapeHtml(item.question);
    const answer = escapeHtml(item.answer);
    // Split answer into paragraphs if it has double newlines
    const answerParagraphs = answer.split(/\n\n+/).filter((p) => p.trim());
    const answerHtml = answerParagraphs.map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n');

    return `
  <div class="qa-item">
    <h3 class="qa-question">${question}</h3>
    <div class="qa-answer">
${answerHtml}
    </div>
  </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Questions & Answers</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; max-width: 700px; }
    .qa-item { margin-bottom: 2em; }
    .qa-question { font-weight: bold; font-size: 1.1em; margin-bottom: 0.5em; color: #333; }
    .qa-answer { margin-left: 1em; }
    .qa-answer p { margin-bottom: 0.8em; }
  </style>
</head>
<body>
<div class="qa-content">
${qaItems}
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
