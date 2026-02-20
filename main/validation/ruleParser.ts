/**
 * MVP rule parser: extract constraints from Profile rules_text.
 * Supports degraded mode when parsing fails.
 */

export type ParsedRules = {
  bulletCounts: Record<string, number>;
  skillsCategories: string[];
  summaryOpener: string | null;
  noStrongInSkills: boolean;
  strongPerBulletCap: number | null;
  minSkillsCount: number | null;
  degraded: boolean;
};

const DEFAULT_PARSED: ParsedRules = {
  bulletCounts: {},
  skillsCategories: [],
  summaryOpener: null,
  noStrongInSkills: false,
  strongPerBulletCap: null,
  minSkillsCount: null,
  degraded: false,
};

/**
 * Parse rules_text into structured constraints. Best-effort; sets degraded if unclear.
 */
export function parseRules(rulesText: string): ParsedRules {
  if (!rulesText || !rulesText.trim()) {
    return { ...DEFAULT_PARSED, degraded: true };
  }

  const text = rulesText.trim();
  const result: ParsedRules = {
    bulletCounts: {},
    skillsCategories: [],
    summaryOpener: null,
    noStrongInSkills: false,
    strongPerBulletCap: null,
    minSkillsCount: null,
    degraded: false,
  };

  try {
    const bulletRegex = /(?:^|\n)\s*(?:(\w+(?:\s+\w+)*)[:\s]+)?(\d+)\s*(?:bullet|point)s?/gi;
    let m: RegExpExecArray | null;
    while ((m = bulletRegex.exec(text)) !== null) {
      const section = m[1]?.trim() || 'default';
      const count = parseInt(m[2], 10);
      if (section && count > 0 && count <= 20) {
        const key = section.toLowerCase().replace(/\s+/g, '_');
        if (!result.bulletCounts[key] || result.bulletCounts[key] < count) {
          result.bulletCounts[key] = count;
        }
      }
    }

    const skillsMatch = text.match(/(?:skills?\s*categories?|categories?)[:\s]+([^\n]+)/i);
    if (skillsMatch) {
      const list = skillsMatch[1].split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      result.skillsCategories = list.slice(0, 20);
    }

    const openerMatch = text.match(/summary\s+(?:must\s+)?(?:start\s+with|opener)[:\s]+["']?([^"'\n]+)["']?/i);
    if (openerMatch) {
      result.summaryOpener = openerMatch[1].trim().slice(0, 100);
    }

    if (/no\s*<strong>|no\s*strong|skills?\s*:\s*no\s*(?:bold|strong)/i.test(text)) {
      result.noStrongInSkills = true;
    }

    const strongCapMatch = text.match(/(?:at\s+most|max(?:imum)?)\s+(\d+)\s*<strong>/i)
      || text.match(/(\d+)\s*<strong>\s*per\s*bullet/i);
    if (strongCapMatch) {
      const cap = parseInt(strongCapMatch[1], 10);
      if (cap >= 0 && cap <= 5) result.strongPerBulletCap = cap;
    }

    const minSkillsMatch = text.match(/min(?:imum)?\s*(?:skills?)?\s*(\d+)/i)
      || text.match(/(\d+)\s+skills?\s*(?:minimum|min)/i);
    if (minSkillsMatch) {
      const n = parseInt(minSkillsMatch[1], 10);
      if (n >= 0 && n <= 100) result.minSkillsCount = n;
    }
  } catch {
    result.degraded = true;
  }

  return result;
}
