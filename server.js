'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');

const { parseMarkdownToSOW } = require('./parser');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Logging Setup ────────────────────────────────────────────────────────────

const LOG_DIR  = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'scopesynth.log');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function writeLog(level, message, meta = {}) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  });
  fs.appendFileSync(LOG_FILE, entry + '\n');
  console.log(entry);
}

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── CRM In-Memory Store (Leads) ──────────────────────────────────────────────

/**
 * leadsDB – runtime store for all CRM leads.
 * Shape: { id, clientName, projectType, email, status, createdAt [, updatedAt] }
 */
const leadsDB = [];

const VALID_STATUSES = ['New Lead', 'Case Study Sent', 'SOW Approved', 'Invoiced'];

const STATUS_PROGRESSION = {
  'New Lead':        'Case Study Sent',
  'Case Study Sent': 'SOW Approved',
  'SOW Approved':    'Invoiced',
  'Invoiced':        null,
};

// ─── GET /api/leads ───────────────────────────────────────────────────────────
// Returns all leads sorted by creation date (newest first).

app.get('/api/leads', (req, res) => {
  const sorted = [...leadsDB].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  writeLog('info', 'GET /api/leads', { count: leadsDB.length });
  return res.status(200).json(sorted);
});

// ─── POST /api/leads/bulk ─────────────────────────────────────────────────────
// Accepts an array of lead objects. Each item: clientName, projectType, email.
// Auto-assigns id (crypto.randomUUID) and createdAt; status defaults to 'New Lead'.

app.post('/api/leads/bulk', (req, res) => {
  const payload = req.body;

  if (!Array.isArray(payload) || payload.length === 0) {
    writeLog('warn', 'POST /api/leads/bulk – invalid payload');
    return res.status(400).json({ error: 'Body must be a non-empty array of lead objects.' });
  }

  const created = [];
  const errors  = [];

  payload.forEach((item, idx) => {
    const { clientName, projectType, email, status } = item;

    if (!clientName || typeof clientName !== 'string' || clientName.trim() === '') {
      errors.push({ index: idx, reason: 'clientName is required' });
      return;
    }
    if (!email || typeof email !== 'string' || email.trim() === '') {
      errors.push({ index: idx, reason: 'email is required' });
      return;
    }

    const lead = {
      id:          crypto.randomUUID(),
      clientName:  clientName.trim(),
      projectType: (projectType || 'General').trim(),
      email:       email.trim().toLowerCase(),
      status:      VALID_STATUSES.includes(status) ? status : 'New Lead',
      createdAt:   new Date().toISOString(),
    };

    leadsDB.push(lead);
    created.push(lead);
  });

  writeLog('info', 'POST /api/leads/bulk', {
    received: payload.length,
    created:  created.length,
    skipped:  errors.length,
  });

  return res.status(201).json({
    message: `${created.length} lead(s) added.`,
    created,
    errors: errors.length ? errors : undefined,
  });
});

// ─── PUT /api/leads/:id/status ────────────────────────────────────────────────
// Body: { status: 'New Lead' | 'Case Study Sent' | 'SOW Approved' | 'Invoiced' }
//   OR: { advance: true } to move to the next stage.

app.put('/api/leads/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, advance } = req.body;

  const lead = leadsDB.find(l => l.id === id);
  if (!lead) {
    writeLog('warn', 'PUT /api/leads/:id/status – lead not found', { id });
    return res.status(404).json({ error: 'Lead not found.' });
  }

  let newStatus;

  if (advance === true) {
    newStatus = STATUS_PROGRESSION[lead.status];
    if (!newStatus) {
      return res.status(400).json({ error: 'Lead is already at the final stage (Invoiced).' });
    }
  } else {
    if (!VALID_STATUSES.includes(status)) {
      writeLog('warn', 'PUT /api/leads/:id/status – invalid status', { status });
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.`,
      });
    }
    newStatus = status;
  }

  const prevStatus = lead.status;
  lead.status    = newStatus;
  lead.updatedAt = new Date().toISOString();

  writeLog('info', 'Lead status updated', { id, from: prevStatus, to: newStatus });
  return res.status(200).json({ message: 'Status updated.', lead });
});

// ─── POST /api/compile-sow ────────────────────────────────────────────────────

app.post('/api/compile-sow', async (req, res) => {
  const { markdownText, apiKey, baseRate, taxRate, multiplier, mode, summaryText, aiContext } = req.body;

  // ── Input validation ────────────────────────────────────────────────────────
  if (!markdownText || typeof markdownText !== 'string' || markdownText.trim() === '') {
    writeLog('warn', 'Missing markdownText');
    return res.status(400).json({ error: 'markdownText is required and must be a non-empty string.' });
  }

  const isManualMode = mode === 'manual';

  // API key is only required for AI mode
  if (!isManualMode && (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '')) {
    writeLog('warn', 'Missing apiKey for AI mode');
    return res.status(400).json({ error: 'apiKey is required for AI generation mode.' });
  }
  // Manual mode requires summaryText
  if (isManualMode && (!summaryText || typeof summaryText !== 'string' || summaryText.trim() === '')) {
    writeLog('warn', 'Missing summaryText for manual mode');
    return res.status(400).json({ error: 'summaryText is required when mode is manual.' });
  }

  // ── Coerce and validate pricing config — fall back to safe defaults ──────────
  const parsedBaseRate   = parseFloat(baseRate);
  const parsedTaxRate    = parseFloat(taxRate);
  const parsedMultiplier = parseFloat(multiplier);

  if (isNaN(parsedBaseRate) || parsedBaseRate <= 0) {
    return res.status(400).json({ error: 'baseRate must be a positive number.' });
  }
  if (isNaN(parsedTaxRate) || parsedTaxRate < 0) {
    return res.status(400).json({ error: 'taxRate must be a non-negative number.' });
  }
  if (isNaN(parsedMultiplier) || parsedMultiplier <= 0) {
    return res.status(400).json({ error: 'multiplier must be a positive number.' });
  }

  const pricingConfig = {
    baseRate:   parsedBaseRate,
    taxRate:    parsedTaxRate,
    multiplier: parsedMultiplier,
  };

  writeLog('info', 'Compile SOW request received', {
    mode:       isManualMode ? 'manual' : 'ai',
    lines:      markdownText.split('\n').length,
    baseRate:   pricingConfig.baseRate,
    taxRate:    pricingConfig.taxRate,
    multiplier: pricingConfig.multiplier,
  });

  // ── Step 1: Deterministic Math — parser.js (AST logic untouched) ────────────
  let financialData;
  try {
    financialData = parseMarkdownToSOW(markdownText, pricingConfig);
    writeLog('info', 'Parser completed', {
      totalHours: financialData.financials.totalHours,
      grandTotal: financialData.financials.grandTotal,
    });
  } catch (parseErr) {
    writeLog('error', 'Parser failure', { error: parseErr.message });
    return res.status(422).json({ error: 'Failed to parse markdown. Ensure items use "- " bullet format.' });
  }

  // ── Step 2: Executive Summary — Manual bypass or BYOK Gemini ────────────────
  let aiSummary;

  if (isManualMode) {
    // ── Manual mode: use the user's own text directly, skip Gemini ──────────────
    aiSummary = summaryText.trim();
    writeLog('info', 'Manual summary used', { chars: aiSummary.length });

  } else {
    // ── AI mode: curated Gemini prompt incorporating aiContext + markdownText ───
    const contextBlock = (aiContext && aiContext.trim())
      ? `Here are the specific ideas, research data, and context to include:\n${aiContext.trim()}\n\n`
      : '';

    const geminiPrompt =
      `Act as an Agency Executive. Write a persuasive 2-paragraph Executive Summary for a Statement of Work.\n\n` +
      contextBlock +
      `And here is the technical scope:\n${markdownText}`;

    const geminiUrl  = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const geminiBody = { contents: [{ parts: [{ text: geminiPrompt }] }] };

    try {
      const geminiRes = await fetch(geminiUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(geminiBody),
      });

      if (!geminiRes.ok) {
        const errBody = await geminiRes.json().catch(() => ({}));
        const detail  = errBody?.error?.message || `HTTP ${geminiRes.status}`;
        writeLog('error', 'Gemini API error', { status: geminiRes.status, detail });
        return res.status(geminiRes.status).json({ error: 'Gemini API returned an error.', detail });
      }

      const geminiData = await geminiRes.json();
      aiSummary = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
      writeLog('info', 'Gemini response received', {
        finishReason: geminiData?.candidates?.[0]?.finishReason ?? 'unknown',
        hasContext:   !!(aiContext && aiContext.trim()),
      });

    } catch (netErr) {
      writeLog('error', 'Network error calling Gemini', { error: netErr.message });
      return res.status(502).json({ error: 'Could not reach Gemini API. Check your network or API key.' });
    }
  }

  // ── Step 3: Respond — API key is NEVER stored or logged ─────────────────────
  return res.status(200).json({ aiSummary, financialData });
});

// ─── Case Study / SOP AI (Gemini) ─────────────────────────────────────────────
const GEMINI_MODEL   = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function callGemini(apiKey, systemPrompt, userPrompt) {
  const url = `${GEMINI_API_URL}?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: { temperature: 0.75, maxOutputTokens: 2048, topP: 0.9 },
  };
  const response = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errBody}`);
  }
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned an empty response.');
  return text;
}

const CASE_STUDY_SYSTEM_PROMPT = `
You are a Senior Marketing Executive and Brand Storyteller at a world-class digital agency.
Your speciality is crafting high-impact case studies that win new business, retain clients, and clearly demonstrate ROI.

Your output must follow this exact structure — no introductory fluff, no sign-offs:

EXECUTIVE SUMMARY
[2–3 sentence hook summarising the project and the headline result. Lead with the ROI metric.]

THE CHALLENGE
[Describe the client's pain point, business problem, or market gap. Use specific language. 2–4 sentences.]

OUR SOLUTION
[Describe what was built or delivered. Focus on the strategic approach and key differentiators. 3–5 sentences.]

KEY RESULTS
[Bullet list of 4–6 quantified outcomes. Format each as: • [Metric] — [Result]. If exact numbers are not provided, extrapolate conservatively.]

CLIENT IMPACT
[Short closing paragraph about business transformation, future potential. 2–3 sentences. Professional.]

Writing rules: Use present-perfect or past tense. Write for C-suite: concise, numbers-first. No jargon. Plain text only — no markdown.
`.trim();

app.post('/api/generate-casestudy', async (req, res) => {
  const { prompt, apiKey } = req.body;
  if (!prompt)  return res.status(400).json({ error: 'prompt is required.' });
  if (!apiKey)  return res.status(400).json({ error: 'apiKey is required.' });
  try {
    const content = await callGemini(apiKey, CASE_STUDY_SYSTEM_PROMPT, prompt);
    writeLog('info', 'AI case study generated', { chars: content.length });
    return res.json({ content });
  } catch (err) {
    writeLog('error', 'AI case study error', { error: err.message });
    return res.status(502).json({ error: err.message });
  }
});

const SOP_SYSTEM_PROMPT = `
You are a Senior Operations Manager and Technical Documentation Specialist with 15+ years experience writing ISO-aligned Standard Operating Procedures for digital agencies and SaaS companies.
Your SOPs are read by junior team members with no prior context — every step must be unambiguous and executable.

Your output must follow this exact structure — do not add introductory text or sign-offs:

PURPOSE
[1–2 sentences stating what this SOP governs and why it exists.]

SCOPE
[Who this SOP applies to. List roles or departments. 1–3 sentences.]

ROLES & RESPONSIBILITIES
[Bullet list of each role involved and their specific responsibility in this process.]

PREREQUISITES
[Bullet list of everything that must be true, completed, or accessible before starting this SOP.]

STEP-BY-STEP INSTRUCTIONS
[Numbered list. Each top-level step uses an action verb. Use sub-steps (1a, 1b...) where needed. Add WARNING and CHECK notes where appropriate.]

QUALITY ASSURANCE
[3–5 bullet points describing how to verify this process was completed correctly.]

ESCALATION PATH
[What to do if the process fails or an exception occurs. 2–4 sentences.]

REVISION HISTORY PLACEHOLDER
[Leave a single line: v[VERSION] — [DATE] — [AUTHOR]]

Writing rules: Use active imperative voice. Number all top-level steps. Plain text only — no markdown.
`.trim();

app.post('/api/generate-sop', async (req, res) => {
  const { prompt, apiKey } = req.body;
  if (!prompt)  return res.status(400).json({ error: 'prompt is required.' });
  if (!apiKey)  return res.status(400).json({ error: 'apiKey is required.' });
  try {
    const content = await callGemini(apiKey, SOP_SYSTEM_PROMPT, prompt);
    writeLog('info', 'AI SOP generated', { chars: content.length });
    return res.json({ content });
  } catch (err) {
    writeLog('error', 'AI SOP error', { error: err.message });
    return res.status(502).json({ error: err.message });
  }
});

// ─── Lead Intake AI Agent (BYOK Gemini) ───────────────────────────────────────
const leadIntakeSessions = new Map(); // session_id -> { stage, messages[], lead_data, company, sector, agent_name }

const LEAD_INTAKE_STAGES = ['greet', 'project', 'budget', 'email', 'summary', 'done'];

function buildLeadIntakeSystemPrompt(company, sector, agentName, stage, leadData) {
  const base = `You are ${agentName}, a senior SDR for ${company} (${sector}). Qualify leads through a structured conversation. Keep responses 2-4 sentences. Be warm and consultative.`;
  const tasks = {
    greet: `Greet warmly. Introduce yourself as ${agentName} from ${company}. Mention ${company} operates in ${sector}. Ask what type of project or requirement they have.`,
    project: `The user shared their project. Acknowledge with enthusiasm. Ask about budget range and timeline.`,
    budget: `Acknowledge budget and timeline. Ask for their business email so ${company} can send a tailored proposal.`,
    email: `Thank them for their email. Say ${company} will follow up. Say you're generating their lead summary now.`,
    summary: `Generate a professional Lead Summary in this format:\n---\nLEAD SUMMARY — ${company}\nCompany: ${company}\nSector: ${sector}\nContact Email: ${leadData.email || 'N/A'}\nProject: ${leadData.project_type || 'N/A'}\nBudget: ${leadData.budget || 'N/A'}\nTimeline: ${leadData.timeline || 'N/A'}\nLead Score: [1-10]\nPriority: [Hot/Warm/Cool]\nNotes: [2-3 sentence assessment]\nNext Action: [Specific next step]\n---\nEnd with: "Thank you! The ${company} team will reach out within 24 hours."`,
    done: 'The conversation is complete. Say a brief goodbye if needed.',
  };
  return `${base}\n\nCURRENT TASK: ${tasks[stage] || tasks.greet}`;
}

function extractLeadDataFromUser(lastHuman, stage, leadData) {
  const d = { ...leadData };
  const emailMatch = lastHuman && lastHuman.match(/[\w.+-]+@[\w-]+\.[a-zA-Z]+/);
  if (emailMatch) d.email = emailMatch[0];
  if (stage === 'project' && lastHuman) d.project_type = lastHuman.slice(0, 200);
  if (stage === 'budget' && lastHuman) {
    const lower = lastHuman.toLowerCase();
    if (/\d|k| lakh|cr|rupee|inr|usd|\$/.test(lower)) d.budget = lastHuman.slice(0, 120);
    if (/week|month|quarter|q\d|asap|timeline/.test(lower)) d.timeline = lastHuman.slice(0, 100);
  }
  return d;
}

app.post('/api/lead-intake/chat', async (req, res) => {
  const { session_id, company, sector, agent_name, message, apiKey } = req.body;
  const sid = session_id || crypto.randomUUID();
  const companyName = (company || 'Our Company').trim() || 'Our Company';
  const sectorName = (sector || 'Technology').trim() || 'Technology';
  const agentName = (agent_name || 'Alex').trim() || 'Alex';
  if (!apiKey) return res.status(400).json({ error: 'apiKey is required for Lead Intake.' });

  let state = leadIntakeSessions.get(sid);
  if (!state) {
    state = { stage: 'greet', messages: [], lead_data: {}, company: companyName, sector: sectorName, agent_name: agentName };
    leadIntakeSessions.set(sid, state);
  }

  if (message) {
    state.messages.push({ role: 'user', content: message });
    state.lead_data = extractLeadDataFromUser(message, state.stage, state.lead_data);
  }

  const sysPrompt = buildLeadIntakeSystemPrompt(state.company, state.sector, state.agent_name, state.stage, state.lead_data);
  const userPrompt = state.messages.length
    ? state.messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n') + '\n\nAssistant:'
    : 'Start the conversation.';

  try {
    const response = await callGemini(apiKey, sysPrompt, userPrompt);
    state.messages.push({ role: 'assistant', content: response });
    const idx = LEAD_INTAKE_STAGES.indexOf(state.stage);
    state.stage = idx >= 0 && idx < LEAD_INTAKE_STAGES.length - 1 ? LEAD_INTAKE_STAGES[idx + 1] : 'done';
    leadIntakeSessions.set(sid, state);
    writeLog('info', 'Lead intake chat', { session_id: sid, stage: state.stage });
    return res.json({ response, stage: state.stage, lead_data: state.lead_data, company: state.company, sector: state.sector });
  } catch (err) {
    writeLog('error', 'Lead intake Gemini error', { error: err.message });
    return res.status(502).json({ error: err.message });
  }
});

// ─── Margin Defender / Margin Audit AI Agent ──────────────────────────────────
const MARGIN_AUDIT_SYSTEM = `You are the Margin Defender — a veteran scope auditor for a premium AI agency. Protect profit margins by identifying every risk in a project scope. Be direct and specific. Output a structured risk report. Agency builds AI agents, SaaS, enterprise automation. Pricing in ₹.`;

app.post('/api/margin-audit', async (req, res) => {
  const { scope, apiKey } = req.body;
  if (!scope || typeof scope !== 'string') return res.status(400).json({ error: 'scope is required.' });
  if (!apiKey) return res.status(400).json({ error: 'apiKey is required.' });
  const scopeText = scope.trim();
  if (scopeText.length < 50) return res.status(400).json({ error: 'Scope must be at least 50 characters for meaningful analysis.' });

  const userPrompt = `Analyze this project scope for margin bleed risks. Output a structured Risk Report with: OVERALL RISK SCORE (X/10), RISK LEVEL, CRITICAL WARNINGS (Issue, Margin Risk, Fix), SCOPE HEALTH SUMMARY, TOP 3 PROTECTIVE CLAUSES. Use clear headings and bullet points.\n\nSCOPE:\n"""\n${scopeText}\n"""`;

  try {
    const report = await callGemini(apiKey, MARGIN_AUDIT_SYSTEM, userPrompt);
    writeLog('info', 'Margin audit completed', { scopeLen: scopeText.length });
    return res.json({ report, status: 'done' });
  } catch (err) {
    writeLog('error', 'Margin audit error', { error: err.message });
    return res.status(502).json({ error: err.message });
  }
});

// ─── Invoices / Documents Store (for Document Engine & Invoice Dashboard) ──────
const invoicesDB = []; // { id, type, docNumber, clientName, grandTotal, status, createdAt, ... }

app.post('/api/invoices', (req, res) => {
  const body = req.body;
  const id = 'INV-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const doc = {
    id,
    type: body.type || 'invoice',
    docNumber: body.docNumber || body.doc_number || id,
    issueDate: body.issueDate || body.issue_date || new Date().toISOString().slice(0, 10),
    dueDate: body.dueDate || body.due_date,
    clientName: body.clientName || body.client?.name || '—',
    clientEmail: body.clientEmail || body.client?.email,
    projectTitle: body.projectTitle || body.project_title,
    lineItems: body.lineItems || [],
    subtotal: body.subtotal,
    tax: body.tax,
    grandTotal: body.grandTotal || body.grand_total,
    status: body.status || 'initiated', // 'initiated' | 'received'
    createdAt: new Date().toISOString(),
    payload: body,
  };
  invoicesDB.push(doc);
  writeLog('info', 'Invoice saved', { id, clientName: doc.clientName });
  return res.status(201).json({ id, message: 'Saved.', doc });
});

app.get('/api/invoices', (req, res) => {
  const list = [...invoicesDB].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return res.json(list);
});

app.get('/api/invoices/stats', (req, res) => {
  const initiated = invoicesDB.filter(d => d.status !== 'received');
  const received = invoicesDB.filter(d => d.status === 'received');
  const totalInitiated = invoicesDB.length;
  const totalReceived = received.length;
  const sum = (arr, key = 'grandTotal') => arr.reduce((a, d) => a + (Number(d[key]) || 0), 0);
  const totalAmountInitiated = sum(initiated);
  const totalAmountReceived = sum(received);
  const totalAmountAll = totalAmountInitiated + totalAmountReceived;
  const averageAmount = totalInitiated ? (totalAmountAll / totalInitiated) : 0;
  return res.json({
    totalInitiated,
    totalReceived,
    totalAmountInitiated: Math.round(totalAmountInitiated * 100) / 100,
    totalAmountReceived: Math.round(totalAmountReceived * 100) / 100,
    totalAmountAll: Math.round(totalAmountAll * 100) / 100,
    averageAmount: Math.round(averageAmount * 100) / 100,
  });
});

app.put('/api/invoices/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const doc = invoicesDB.find(d => d.id === id);
  if (!doc) return res.status(404).json({ error: 'Invoice not found.' });
  if (status === 'initiated' || status === 'received') {
    doc.status = status;
    return res.json({ message: 'Updated.', doc });
  }
  return res.status(400).json({ error: 'status must be initiated or received.' });
});

const INVOICE_AI_SYSTEM = `You are an invoice analytics assistant for a small agency. Given summary stats and recent invoice data, provide 3–5 short, actionable insights or recommendations in clear bullet points. Focus on cash flow, pending vs received, and simple improvements. Use ₹ for amounts. Keep each point to one or two sentences.`;

app.post('/api/invoices/ai-insights', async (req, res) => {
  const { apiKey, summary } = req.body;
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) return res.status(400).json({ error: 'apiKey is required for AI insights.' });
  if (!summary || typeof summary !== 'string') return res.status(400).json({ error: 'summary is required (JSON or text description of invoice stats).' });
  try {
    const insights = await callGemini(apiKey.trim(), INVOICE_AI_SYSTEM, summary);
    writeLog('info', 'Invoice AI insights generated', { summaryLen: summary.length });
    return res.json({ insights: insights.trim() });
  } catch (err) {
    writeLog('error', 'Invoice AI insights error', { error: err.message });
    return res.status(502).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  writeLog('info', 'ScopeSynth OS server running', { port: PORT });
});
