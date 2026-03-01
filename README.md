# ScopeSynth OS — The Cyborg Agency Engine

ScopeSynth OS kills the agency paperwork struggle. It's an end-to-end **cyborg engine** that uses secure **BYOK AI** for case studies and **deterministic AST math** to instantly compile nested features into trackable, perfectly priced SOWs and invoices.

---

## The Problem: The Margin Bleed & Financial Hallucinations

The agency software market is fragmented. Agencies rely on glorified document editors that don't calculate scope, or lazy AI wrappers that guess project hours, causing **financial hallucinations**. Relying on manual guesswork or unpredictable LLMs means agencies routinely lose **20% of profit margins**, while clients dispute vague paperwork.

---

## The Solution: ScopeSynth OS

ScopeSynth OS brings **computer science to agency sales**. It's an end-to-end **Cyborg OS** built to automate the agency pipeline with **mathematical proof**. By blending **Generative AI** (persuasion, market research, case studies) with **Deterministic Algorithms** (pricing), we eliminate the paperwork struggle. The result is **mathematically bulletproof** Statements of Work (SOWs) and customisable invoices.

---

## How It Works (The Cyborg Architecture)

We enforce a strict boundary between **deterministic math** and **AI**:

- **AST Algorithm Superiority** — Users input a nested Markdown feature list. Our custom Node.js backend parses it into an **Abstract Syntax Tree (AST)**. It mathematically assigns billable hours based on node depth (e.g. Epic = 10h, Task = 2h), calculates the agency rate, and injects local taxes (18% GST) with **100% deterministic accuracy**. Zero hallucinations.

- **BYOK AI Persuasion** — Using a zero-trust **"Bring Your Own Key"** model, users temporarily paste their OpenAI/Gemini key in-memory to dynamically generate **Executive Summaries** and **Case Studies**.

- **Trackable Assembly** — The OS merges the AI pitch and AST math into a flawless, **downloadable PDF SOW** and trackable invoice mechanism.

---

## Business Model & Tech Stack

Unlike bloated Enterprise SaaS pricing around **$50 per month per user**, ScopeSynth OS is a lean **micro-SaaS** at **$5–$20/month per firm license**. It is built entirely using custom **Complete.dev Agents** swarm with the **"SOW Logic Engine"** (math) and the **"Pitch Architect"** (BYOK integration & UI).

---

## Quick Start

```bash
npm install
npm start
```

Then open **http://localhost:3000** in your browser. The app is served from the `public` folder (single-page UI at `/`).

---

## Project Layout

| Path | Description |
|------|-------------|
| **`server.js`** | Express server: `/api/compile-sow` (parse markdown + optional Gemini summary), static files from `public/`, logs in `logs/` |
| **`parser.js`** | SOW Logic Engine: markdown → AST, hours by depth, configurable base rate / tax / multiplier |
| **`public/index.html`** | Pitch Architect UI: scope builder, document settings, compile, PDF-ready template |
| **`logs/`** | Created on first run; `scopesynth.log` for request/error logs |

---

## Requirements

- **Node.js 18+**
- For **AI mode**: Gemini API key (entered in the UI; not stored)

---

## Usage

1. **Document settings** — Client, project, agency names; PDF header/footer; optional letterhead (URL or upload).
2. **Agency global settings** — Base hourly rate (₹), tax %, team allocation multiplier.
3. **Executive summary** — Manual (type your own) or AI (Gemini 2.5 Flash; needs API key).
4. **Scope builder** — Pick phase + feature or type custom; add items. Scope is markdown bullets (`- Phase` / `  - Feature`).
5. **Compile SOW** — Deterministic line-item math + optional AI summary; view results and **Download SOW as PDF** (browser print dialog).
