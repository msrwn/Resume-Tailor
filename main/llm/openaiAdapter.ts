import OpenAI from 'openai';
import { getApiKey } from '../config/secretsManager';
import { readConfig } from '../config/configManager';
import { parseStrictJson } from './parseJson';
import { buildCallAMessages } from './callAPrompt';
import { buildCallBMessages } from './callBPrompt';
import type { CallAOutput, CallBOutput } from '../../shared/types';

export type LlmUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type JdExtractionResult = {
  success: true;
  json: CallAOutput;
  rawText: string;
  usage?: LlmUsage;
  modelUsed: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
};

export type JdExtractionFailure = {
  success: false;
  error: string;
  rawText?: string;
  modelUsed: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
};

export type JdExtractionResponse = JdExtractionResult | JdExtractionFailure;

async function getOpenAIClient(): Promise<OpenAI> {
  const key = await getApiKey();
  if (!key) throw new Error('API key not set');
  if (!key.startsWith('sk-')) {
    console.warn(`API key format warning: key does not start with 'sk-' (starts with: ${key.substring(0, 3)})`);
  }
  const config = readConfig();
  const options: ConstructorParameters<typeof OpenAI>[0] = { apiKey: key };
  const baseURL = config.openaiBaseURL?.trim();
  if (baseURL) {
    options.baseURL = baseURL;
    console.log(`Using custom API base URL: ${baseURL}`);
  } else {
    console.log('Using default OpenAI API endpoint: https://api.openai.com/v1');
  }
  console.log(`API key present: ${key.substring(0, 7)}...${key.substring(key.length - 4)} (length: ${key.length})`);
  return new OpenAI(options);
}

function capRawText(raw: string, maxLen = 2000): string {
  if (raw.length <= maxLen) return raw;
  return raw.substring(0, maxLen) + '...[truncated]';
}

/**
 * Run Call A: JD Extraction with retry and optional fallback.
 */
export async function runJdExtraction(params: {
  jdText: string;
  jobUrl?: string;
  model?: string;
  fallbackModel?: string;
  retryCount: number;
  fallbackEnabled: boolean;
}): Promise<JdExtractionResponse> {
  const config = readConfig();
  const model = params.model || config.jdExtractionModel || 'gpt-4o-mini';
  const fallbackModel = params.fallbackModel || config.fallbackModel || 'gpt-4o-mini';
  const retryCount = params.retryCount ?? config.retryCountCallA;
  const fallbackEnabled = params.fallbackEnabled ?? config.fallbackEnabled;

  const client = await getOpenAIClient();
  const messages = buildCallAMessages(params.jdText, params.jobUrl);

  const runWithModel = async (useModel: string): Promise<{ raw: string; usage?: LlmUsage }> => {
    try {
      const completion = await client.chat.completions.create({
        model: useModel,
        messages,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content ?? '';
      const usage = completion.usage
        ? {
            prompt_tokens: completion.usage.prompt_tokens,
            completion_tokens: completion.usage.completion_tokens,
            total_tokens: completion.usage.total_tokens,
          }
        : undefined;

      return { raw: content, usage };
    } catch (err) {
      // Re-throw with more context
      if (err instanceof Error) {
        const enhancedErr = new Error(
          `${err.message}${(err as any).status ? ` (HTTP ${(err as any).status})` : ''}${(err as any).code ? ` [${(err as any).code}]` : ''}`
        );
        (enhancedErr as any).originalError = err;
        throw enhancedErr;
      }
      throw err;
    }
  };

  const tryParse = (raw: string): JdExtractionResult | null => {
    const parsed = parseStrictJson<CallAOutput>(raw);
    if (!parsed.success) return null;
    const d = parsed.data;
    if (!d || typeof d !== 'object') return null;
    if (!d.contact || typeof d.contact !== 'object') {
      (d as any).contact = { email: null, phone: null, follow_up_links: null, source_text_snippets: null };
    }
    return {
      success: true,
      json: d as CallAOutput,
      rawText: capRawText(raw),
      usage: undefined,
      modelUsed: model,
      fallbackUsed: false,
    };
  };

  let lastRaw = '';

  // Retries with primary model
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const { raw, usage } = await runWithModel(model);
      lastRaw = raw;
      const result = tryParse(raw);
      if (result) {
        result.usage = usage;
        return result;
      }
    } catch (err) {
      let errDetails = '';
      if (err instanceof Error) {
        const errAny = err as any;
        errDetails = `${err.name}: ${err.message}`;
        if (errAny.status) errDetails += ` (HTTP ${errAny.status})`;
        if (errAny.code) errDetails += ` [${errAny.code}]`;
        if (errAny.cause) {
          const cause = errAny.cause;
          if (cause instanceof Error) {
            errDetails += ` | Cause: ${cause.name}: ${cause.message}`;
            if ((cause as any).code) errDetails += ` [${(cause as any).code}]`;
          } else {
            errDetails += ` | Cause: ${String(cause)}`;
          }
        }
        if (err.stack) {
          console.error(`JD extraction attempt ${attempt + 1} failed:`, err.stack);
        } else {
          console.error(`JD extraction attempt ${attempt + 1} failed:`, err);
        }
      } else {
        errDetails = String(err);
        console.error(`JD extraction attempt ${attempt + 1} failed (non-Error):`, err);
      }
      lastRaw = errDetails;
      if (attempt === retryCount && fallbackEnabled) break;
      continue;
    }
  }

  // Fallback model once
  if (fallbackEnabled) {
    try {
      const { raw, usage } = await runWithModel(fallbackModel);
      lastRaw = raw;
      const result = tryParse(raw);
      if (result) {
        result.modelUsed = fallbackModel;
        result.fallbackUsed = true;
        result.fallbackReason = 'Primary model failed or invalid JSON';
        result.usage = usage;
        return result;
      }
    } catch (err) {
      let errDetails = '';
      if (err instanceof Error) {
        const errAny = err as any;
        errDetails = `${err.name}: ${err.message}`;
        if (errAny.status) errDetails += ` (HTTP ${errAny.status})`;
        if (errAny.code) errDetails += ` [${errAny.code}]`;
        if (errAny.cause) {
          const cause = errAny.cause;
          if (cause instanceof Error) {
            errDetails += ` | Cause: ${cause.name}: ${cause.message}`;
            if ((cause as any).code) errDetails += ` [${(cause as any).code}]`;
          } else {
            errDetails += ` | Cause: ${String(cause)}`;
          }
        }
        console.error('JD extraction fallback failed:', err.stack || err);
      } else {
        errDetails = String(err);
        console.error('JD extraction fallback failed (non-Error):', err);
      }
      lastRaw = errDetails;
    }
  }

  const rawSnippet = capRawText(lastRaw, 500);
  const isConnectionError = /connection\s*error|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|network|fetch failed/i.test(lastRaw);
  const isLikelyApiError =
    lastRaw.length < 500 ||
    /(?:error|invalid|401|403|429|rate limit|api key|authentication)/i.test(lastRaw);
  let errorMessage: string;
  if (isConnectionError && rawSnippet) {
    errorMessage = `Cannot reach the API (${rawSnippet}). Check your internet connection, firewall, or proxy. In Settings you can set a custom API base URL if you use a proxy.`;
  } else if (isLikelyApiError && rawSnippet) {
    errorMessage = rawSnippet;
  } else {
    errorMessage = `Invalid or unexpected response from model${rawSnippet ? `. Preview: ${rawSnippet}` : ''}`;
  }

  return {
    success: false,
    error: errorMessage,
    rawText: capRawText(lastRaw),
    modelUsed: model,
    fallbackUsed: fallbackEnabled,
    fallbackReason: fallbackEnabled ? 'Fallback also failed or invalid JSON' : undefined,
  };
}

// --- Call B: Resume Payload + Cover Letter ---

export type ResumePayloadResult = {
  success: true;
  json: CallBOutput;
  rawText: string;
  usage?: LlmUsage;
  modelUsed: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
};

export type ResumePayloadFailure = {
  success: false;
  error: string;
  rawText?: string;
  modelUsed: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
};

export type ResumePayloadResponse = ResumePayloadResult | ResumePayloadFailure;

/**
 * Run Call B: Resume Payload + Cover Letter with retry and optional fallback.
 */
export async function runResumePayload(params: {
  jdText: string;
  callA: CallAOutput;
  baseResumeText?: string;
  promptText?: string;
  questions?: string[];
  model?: string;
  fallbackModel?: string;
  retryCount: number;
  fallbackEnabled: boolean;
}): Promise<ResumePayloadResponse> {
  const config = readConfig();
  const model = params.model ?? config.resumePayloadModel ?? config.jdExtractionModel ?? 'gpt-4o-mini';
  const fallbackModel = params.fallbackModel ?? config.fallbackModel ?? 'gpt-4o-mini';
  const retryCount = params.retryCount ?? config.retryCountCallB;
  const fallbackEnabled = params.fallbackEnabled ?? config.fallbackEnabled;

  const client = await getOpenAIClient();
  const messages = buildCallBMessages(
    params.jdText,
    params.callA,
    params.baseResumeText,
    params.promptText,
    params.questions
  );

  const runWithModel = async (useModel: string): Promise<{ raw: string; usage?: LlmUsage }> => {
    const completion = await client.chat.completions.create({
      model: useModel,
      messages,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });
    const content = completion.choices[0]?.message?.content ?? '';
    const usage = completion.usage
      ? {
          prompt_tokens: completion.usage.prompt_tokens,
          completion_tokens: completion.usage.completion_tokens,
          total_tokens: completion.usage.total_tokens,
        }
      : undefined;
    return { raw: content, usage };
  };

  const tryParse = (raw: string): ResumePayloadResult | null => {
    const parsed = parseStrictJson<Record<string, unknown>>(raw);
    if (!parsed.success) return null;
    const d = parsed.data;
    if (!d || typeof d !== 'object') return null;

    // Structured schema: meta + resume + cover_letter
    const meta = d.meta as Record<string, unknown> | undefined;
    const resume = d.resume as Record<string, unknown> | undefined;
    const rawCover = d.cover_letter;
    const coverText =
      typeof rawCover === 'string'
        ? rawCover
        : typeof rawCover === 'object' && rawCover !== null && typeof (rawCover as { text?: string }).text === 'string'
          ? (rawCover as { text: string }).text
          : '';
    if (meta && typeof meta === 'object' && resume && typeof resume === 'object' && coverText) {
      const ownerFirstName = typeof meta.owner_first_name === 'string' ? meta.owner_first_name : 'Candidate';
      const companyName = typeof meta.company_name === 'string' ? meta.company_name : null;
      const jobTitle = typeof meta.job_title === 'string' ? meta.job_title : null;
      const rawQaRules = d.qa;
      const qa = Array.isArray(rawQaRules)
        ? rawQaRules
            .filter((item) => item && typeof item === 'object' && typeof item.question === 'string' && typeof item.answer === 'string')
            .map((item) => ({ question: String(item.question), answer: String(item.answer) }))
        : undefined;
      const callBOutput: CallBOutput = {
        owner_first_name: ownerFirstName,
        company_name: companyName,
        job_title: jobTitle,
        cover_letter_text: coverText,
        meta: meta as CallBOutput['meta'],
        resume: resume as CallBOutput['resume'],
        cover_letter: { text: coverText },
        qa,
        validation_targets: d.validation_targets as Record<string, unknown> | undefined,
      };
      return {
        success: true,
        json: callBOutput,
        rawText: capRawText(raw),
        usage: undefined,
        modelUsed: model,
        fallbackUsed: false,
      };
    }

    // If the object doesn't match the structured schema, treat it as invalid.
    return null;
  };

  let lastRaw = '';
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const { raw, usage } = await runWithModel(model);
      lastRaw = raw;
      const result = tryParse(raw);
      if (result) {
        result.usage = usage;
        return result;
      }
    } catch (err) {
      lastRaw = err instanceof Error ? err.message : String(err);
      if (attempt === retryCount && fallbackEnabled) break;
    }
  }

  if (fallbackEnabled) {
    try {
      const { raw, usage: fallbackUsage } = await runWithModel(fallbackModel);
      lastRaw = raw;
      const result = tryParse(raw);
      if (result) {
        result.modelUsed = fallbackModel;
        result.fallbackUsed = true;
        result.fallbackReason = 'Primary model failed or invalid JSON';
        result.usage = fallbackUsage;
        return result;
      }
    } catch (err) {
      lastRaw = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    success: false,
    error: lastRaw ? capRawText(lastRaw, 500) : 'Resume payload generation failed after retries and fallback',
    rawText: capRawText(lastRaw),
    modelUsed: model,
    fallbackUsed: fallbackEnabled,
  };
}

// --- QA-only helper: generate answers for questions using existing tailored resume + JD ---

export type QaResult = {
  success: true;
  qa: Array<{ question: string; answer: string }>;
  rawText: string;
  usage?: LlmUsage;
  modelUsed: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
};

export type QaFailure = {
  success: false;
  error: string;
  rawText?: string;
  modelUsed: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
};

export type QaResponse = QaResult | QaFailure;

/**
 * Run QA-only call: given an existing Call B output (meta + resume) and JD, answer questions.
 * Does NOT regenerate resume or cover letter; it only returns qa[].
 */
export async function runQaOnly(params: {
  jdText: string;
  callB: CallBOutput;
  questions: string[];
  model?: string;
  fallbackModel?: string;
  retryCount: number;
  fallbackEnabled: boolean;
}): Promise<QaResponse> {
  const config = readConfig();
  const model = params.model ?? config.resumePayloadModel ?? config.jdExtractionModel ?? 'gpt-4o-mini';
  const fallbackModel = params.fallbackModel ?? config.fallbackModel ?? 'gpt-4o-mini';
  const retryCount = params.retryCount ?? config.retryCountCallB;
  const fallbackEnabled = params.fallbackEnabled ?? config.fallbackEnabled;

  if (!params.questions || params.questions.length === 0) {
    return {
      success: false,
      error: 'At least one question is required',
      rawText: '',
      modelUsed: model,
      fallbackUsed: false,
    };
  }

  const client = await getOpenAIClient();

  const jdSnippet = params.jdText.length > 8000 ? `${params.jdText.slice(0, 8000)}\n...[truncated]` : params.jdText;
  const resumeJson = JSON.stringify(
    {
      meta: params.callB.meta,
      resume: params.callB.resume,
    },
    null,
    2
  );
  const questionsList = params.questions.map((q, i) => `${i + 1}. ${q}`).join('\n');

  const systemPrompt =
    'You are a career coach helping a candidate prepare answers for job-application questions. ' +
    'Use ONLY the provided tailored resume JSON and job description as your sources. ' +
    'Return ONLY a single valid JSON object with a "qa" array; no markdown, no commentary.';

  const userContent = `
JOB DESCRIPTION (excerpt, plain text):
${jdSnippet}

TAILORED RESUME JSON (meta + resume) – this is already tailored for the job, do NOT rewrite it:
${resumeJson}

QUESTIONS TO ANSWER:
${questionsList}

RESPONSE FORMAT:
Return ONLY a JSON object of the form:
{
  "qa": [
    { "question": "original question text", "answer": "short but specific answer grounded in resume + JD" }
  ]
}

Rules:
- Each answer must be grounded in the provided resume + JD (no invented experience or employers).
- Use a confident, first-person voice ("I ...").
- Answers should generally be 2–5 sentences, concise but specific.
- Preserve the original question text in the "question" field.
`;

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];

  const runWithModel = async (useModel: string): Promise<{ raw: string; usage?: LlmUsage }> => {
    const completion = await client.chat.completions.create({
      model: useModel,
      messages,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });
    const content = completion.choices[0]?.message?.content ?? '';
    const usage = completion.usage
      ? {
          prompt_tokens: completion.usage.prompt_tokens,
          completion_tokens: completion.usage.completion_tokens,
          total_tokens: completion.usage.total_tokens,
        }
      : undefined;
    return { raw: content, usage };
  };

  const tryParse = (raw: string, usedModel: string, usedFallback: boolean): QaResult | null => {
    const parsed = parseStrictJson<{ qa?: unknown }>(raw);
    if (!parsed.success) return null;
    const data = parsed.data;
    if (!data || typeof data !== 'object') return null;
    const rawQa = (data as any).qa;
    if (!Array.isArray(rawQa)) return null;
    const qa = rawQa
      .filter(
        (item) =>
          item &&
          typeof item === 'object' &&
          typeof (item as any).question === 'string' &&
          typeof (item as any).answer === 'string'
      )
      .map((item) => ({
        question: String((item as any).question),
        answer: String((item as any).answer),
      }));
    if (qa.length === 0) return null;
    return {
      success: true,
      qa,
      rawText: capRawText(raw),
      usage: undefined,
      modelUsed: usedModel,
      fallbackUsed: usedFallback,
      fallbackReason: usedFallback ? 'Primary model failed or returned invalid QA JSON' : undefined,
    };
  };

  let lastRaw = '';

  // Primary model with retries
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const { raw, usage } = await runWithModel(model);
      lastRaw = raw;
      const result = tryParse(raw, model, false);
      if (result) {
        result.usage = usage;
        return result;
      }
    } catch (err) {
      lastRaw = err instanceof Error ? err.message : String(err);
      if (attempt === retryCount && fallbackEnabled) break;
    }
  }

  // Fallback model once
  if (fallbackEnabled) {
    try {
      const { raw, usage } = await runWithModel(fallbackModel);
      lastRaw = raw;
      const result = tryParse(raw, fallbackModel, true);
      if (result) {
        result.usage = usage;
        return result;
      }
    } catch (err) {
      lastRaw = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    success: false,
    error: lastRaw ? capRawText(lastRaw, 500) : 'QA generation failed after retries and fallback',
    rawText: capRawText(lastRaw),
    modelUsed: model,
    fallbackUsed: fallbackEnabled,
  };
}
