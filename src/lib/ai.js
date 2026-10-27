// Browser-side AI client. It never holds an API key: every request goes to this app's own
// server at /api/ai, which adds the key, the guardrail system prompt and rate limiting.
import { useEffect, useMemo, useState } from 'react';

export const AI_RULES = `You are the AI Transformation Advisor inside "SAP Transformation Intelligence Studio", helping an SAP programme team migrate from SAP ECC to SAP S/4HANA Cloud Private Edition under RISE with SAP.
Rules you must follow:
- Use ONLY the project data provided. If the data does not contain the answer, say so and name the evidence needed.
- All project data is SYNTHETIC demonstration data for the fictional company ABC Manufacturing; never present it as real customer facts.
- Never invent SAP licence prices, cloud prices, downtime figures, durations or SAP note numbers. Never claim an SAP tool was run; only uploaded evidence was analysed.
- Never claim SAP officially supports a configuration unless the data says it was confirmed. Treat BTP services and hyperscaler options as "entitlement not verified" unless stated.
- Your output is a proposal that a named human must approve.
Format every answer with these short sections: Recommendation, Evidence (cite record IDs), Assumptions, Confidence (High/Medium/Low and why), Next action, Approval needed (role). Keep it under 250 words. Use plain text, no markdown tables.`;

const AI_ERR = {
  not_configured: 'AI is not configured on this server. An administrator must set ANTHROPIC_API_KEY. Rules-based guidance still works.',
  rate_limited: 'Too many AI requests at once. Wait a minute, then try again.',
  prompt_too_large: 'That request carried too much data. Narrow the selection and try again.',
  invalid_json: 'The AI reply could not be read as data. Try again or narrow the selection.',
  unauthorized: 'Your session is not authorised to use AI features.',
  upstream_error: 'The AI service returned an error. Try again shortly.',
  network: 'The server could not be reached. Check your connection and try again.',
  cancelled: 'Stopped.',
};
export const aiErrorText = (e) => AI_ERR[e && e.code] || 'The AI request failed. Rules-based guidance still works.';

class AIError extends Error {
  constructor(code, message, text) { super(message || code); this.code = code; this.text = text; }
}

function toMessages(input) {
  if (typeof input === 'string') return [{ role: 'user', content: input }];
  if (Array.isArray(input)) return input.map((m) => ({ role: m.role, content: String(m.content) }));
  throw new AIError('bad_request', 'Input must be a string or a list of turns');
}

/**
 * Ask the model. Streams text through onText({text, delta}) and resolves with {text}.
 * opts: { onText, signal, modelTier: 'quick' | 'default', maxTokens }
 */
export async function askAI(input, opts = {}) {
  const { onText, signal, modelTier = 'default', maxTokens } = opts;
  let res;
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ messages: toMessages(input), tier: modelTier, maxTokens }),
      signal,
    });
  } catch (e) {
    if (e && e.name === 'AbortError') throw new AIError('cancelled');
    throw new AIError('network', e && e.message);
  }
  if (!res.ok) {
    let body = {};
    try { body = await res.json(); } catch { /* ignore */ }
    throw new AIError(body.code || (res.status === 429 ? 'rate_limited' : res.status === 413 ? 'prompt_too_large' : res.status === 401 ? 'unauthorized' : 'upstream_error'), body.message);
  }
  // NDJSON stream: {"t":"delta","text":"..."} ... {"t":"done"} | {"t":"error","code":"..."}
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let text = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const ev = JSON.parse(line);
        if (ev.t === 'delta') { text += ev.text; onText && onText({ text, delta: ev.text }); }
        else if (ev.t === 'error') throw new AIError(ev.code || 'upstream_error', ev.message, text);
      }
    }
  } catch (e) {
    if (e instanceof AIError) throw e;
    if (e && e.name === 'AbortError') throw new AIError('cancelled', 'Stopped', text);
    throw new AIError('network', e && e.message, text);
  }
  return { text, truncated: false };
}

/** Tolerant JSON extraction: whole reply, a fenced block, or first {/[ to last }/]. */
export function parseJSONReply(raw) {
  const t = String(raw || '').trim();
  const tries = [t];
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) tries.push(fence[1]);
  const a = Math.min(...['{', '['].map((c) => (t.indexOf(c) < 0 ? Infinity : t.indexOf(c))));
  const b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (a !== Infinity && b > a) tries.push(t.slice(a, b + 1));
  for (const s of tries) { try { return JSON.parse(s); } catch { /* next */ } }
  throw new AIError('invalid_json', 'Reply was not JSON', raw);
}

export async function askAIJSON(input, opts = {}) {
  const suffix = '\n\nReply with the JSON value only: no prose before or after it.';
  const withHint = typeof input === 'string' ? input + suffix : [...input.slice(0, -1), { ...input[input.length - 1], content: input[input.length - 1].content + suffix }];
  const { text } = await askAI(withHint, { ...opts, onText: undefined });
  return parseJSONReply(text);
}

/** React hook: reports whether the server has AI configured and exposes ask / ask.json. */
export function useAI() {
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    let alive = true;
    fetch('/api/ai/status', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((j) => alive && setStatus(j.enabled ? 'ready' : 'off'))
      .catch(() => alive && setStatus('off'));
    return () => { alive = false; };
  }, []);
  const ask = useMemo(() => {
    const f = (input, opts) => (status === 'ready' ? askAI(input, opts) : Promise.reject(new AIError('not_configured')));
    f.json = (input, opts) => (status === 'ready' ? askAIJSON(input, opts) : Promise.reject(new AIError('not_configured')));
    return f;
  }, [status]);
  return { status, ask };
}
