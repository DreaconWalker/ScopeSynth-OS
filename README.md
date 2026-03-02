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

## How to Run This Project

**Full step-by-step guide:** see **[docs/SETUP.md](docs/SETUP.md)** for prerequisites, install, run, port options, and troubleshooting.

**Quick run (if Node.js 18+ is already installed):**

```bash
# From the project root (where package.json lives)
npm install
npm start
```

Then open **http://localhost:3000** in your browser. The app is served from the `public` folder (single-page UI at `/`).

---

## Project Layout

| Path | Description |
|------|-------------|
| **`server.js`** | Express server: `/api/compile-sow`, **leads API** (`GET/POST /api/leads`, `PUT /api/leads/:id/status`), static files from `public/`, logs in `logs/` |
| **`parser.js`** | SOW Logic Engine: markdown → AST, hours by depth, configurable base rate / tax / multiplier |
| **`public/index.html`** | SOW Builder UI: scope builder, document settings, compile, PDF export |
| **`public/dashboard.html`** | **CRM Dashboard** — Kanban lead pipeline, CSV bulk upload, stage progression, links to SOW/Invoice/SOP/Document Engine/Invoices |
| **`public/lead-intake.html`** | **Lead Intake AI Agent** — BYOK Gemini SDR chat; qualifies leads (project, budget, email) and generates lead summary |
| **`public/margin-audit.html`** | **Margin Defender AI** — Paste scope/SOW; BYOK Gemini returns a risk audit report (margin bleed, protective clauses) |
| **`public/document-engine.html`** | **Document Engine** — SOW / Tax Invoice builder with deterministic AST-style math (base rate, multiplier, GST); Save to Invoices |
| **`public/invoice-dashboard.html`** | **Invoice Dashboard** — Analytics (Total Initiated, Total Received); list of saved invoices with Mark Received and Print PDF |
| **`docs/SETUP.md`** | **Detailed setup & run guide** — prerequisites, install, run, port, troubleshooting |
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

---

## CRM Dashboard

Open **http://localhost:3000/dashboard.html** (or click **CRM** in the SOW Builder header) for the Kanban lead pipeline:

- **Bulk upload** — CSV with columns *Client Name*, *Project Type*, *Email* (file input or drag-and-drop); header normalisation and RFC 4180 quoted fields supported.
- **Four stages** — New Lead → Case Study Sent → SOW Approved → Invoiced; per-stage colours (sky/amber/emerald/violet) and card counts.
- **Doc actions** — New Lead: *Draft Case Study* → SOW Builder with `?type=casestudy&client=…`; Case Study Sent: *Build SOW* → `?client=…`; SOW Approved: *Generate Invoice* → `?type=invoice&client=…`; Invoiced: ✅ badge only.
- **→ Next Stage** — Calls `PUT /api/leads/:id/status` with `{ advance: true }` and re-renders; toasts for success/error.
- **Export to Excel** — Downloads the current lead pipeline as a CSV file (Excel-compatible): ID, Client Name, Project Type, Email, Status, Created At, Updated At. RFC 4180 quoted fields; filename `scopesynth-leads-YYYY-MM-DD.csv`.

---

## Lead Intake Agent & Margin Defender

- **Lead Intake** (`/lead-intake.html`) — Configure company, sector, and SDR name; chat with a Gemini-powered SDR to capture project type, budget, timeline, and email. BYOK API key. Sessions stored in-memory on the server.
- **Margin Defender** (`/margin-audit.html`) — Paste draft scope or SOW; get a structured risk audit (score, warnings, protective clauses). BYOK API key. Uses `POST /api/margin-audit`.

---

## Document Engine & Invoice Dashboard

- **Document Engine** (`/document-engine.html`) — Toggle between **Statement of Work** and **Tax Invoice**. Sidebar: client details, document #, dates, base rate, team multiplier, GST toggle, payment terms. Line items table with add/delete; **deterministic math** (subtotal → multiplier → GST → grand total). **Save to Database** posts to `POST /api/invoices`; **Export PDF** uses browser print.
- **Invoice Dashboard** (`/invoice-dashboard.html`) — **Analytics**: Total Initiated (all saved invoices), Total Received (invoices marked received). Table: Doc #, Client, Project, Amount, Status, **Mark Received** (PUT `/api/invoices/:id/status`), **Print PDF** (opens Document Engine with client pre-filled for re-export).
