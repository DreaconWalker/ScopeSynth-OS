'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs');

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

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  writeLog('info', 'ScopeSynth OS server running', { port: PORT });
});
