# ScopeSynth OS — Setup & Run Guide

This guide walks you through running ScopeSynth OS on your machine from clone to first SOW.

---

## 1. Prerequisites

Before running the project, ensure you have:

| Requirement | Details |
|-------------|---------|
| **Node.js** | Version **18 or higher** (LTS recommended). Check with `node -v`. |
| **npm** | Comes with Node.js. Check with `npm -v`. |
| **Git** | Only if you clone the repo. Check with `git --version`. |
| **Gemini API key** | Optional. Required only for **AI mode** (Executive Summary generation). Get one from [Google AI Studio](https://aistudio.google.com/). |

---

## 2. Get the Project

### Option A: Clone from GitHub

```bash
git clone https://github.com/DreaconWalker/ScopeSynth-OS.git
cd ScopeSynth-OS
```

### Option B: You already have the folder

If you downloaded or copied the project, just open a terminal in the project root (where `package.json` and `server.js` are).

```bash
cd /path/to/ScopeSynth-OS
```

---

## 3. Install Dependencies

From the project root, run:

```bash
npm install
```

This installs:

- **express** — Web server and API
- Any other dependencies listed in `package.json`

You should see `node_modules/` created and a message like `added N packages`.

---

## 4. Run the Server

Start the application with:

```bash
npm start
```

This runs `node server.js`. You should see something like:

```text
{"timestamp":"...","level":"info","message":"ScopeSynth OS server running","port":3000}
```

The server is now listening on **port 3000**.

---

## 5. Open the App in Your Browser

1. Open a browser (Chrome, Firefox, Safari, or Edge).
2. Go to: **http://localhost:3000**
3. You see the **landing page** (`public/index.html`). Use **Start Free** or **Enter OS** to open the **CRM Dashboard** (`/dashboard.html`), or go directly to **SOW Builder** (`/sow-builder.html`), **Document Engine** (`/document-engine.html`), **Invoice Dashboard** (`/invoice-dashboard.html`), **Lead Intake** (`/lead-intake.html`), or **Margin Audit** (`/margin-audit.html`) from the footer or dashboard nav.

---

## 6. Optional: Change the Port

By default the server uses port **3000**. To use another port (e.g. 8080), set the `PORT` environment variable:

**On macOS / Linux (current terminal only):**

```bash
PORT=8080 npm start
```

**On Windows (Command Prompt):**

```cmd
set PORT=8080 && npm start
```

**On Windows (PowerShell):**

```powershell
$env:PORT=8080; npm start
```

Then open **http://localhost:8080** (or whatever port you set).

---

## 7. Project Structure (What Runs Where)

| Path | Purpose |
|------|---------|
| `server.js` | Entry point. Express server, serves `public/`, and all API routes below. |
| `parser.js` | SOW Logic Engine. Markdown → AST, hours and pricing. |
| `public/` | Static files. See table below for key pages. |
| `logs/` | Created on first run. `scopesynth.log` stores request/error logs. |
| `node_modules/` | Installed by `npm install`. Do not edit. |

**Key pages in `public/`:**

| File | Purpose |
|------|---------|
| `index.html` | Landing page (marketing). |
| `dashboard.html` | CRM — Kanban lead pipeline, CSV upload, links to SOW/Invoice/SOP. |
| `sow-builder.html` | SOW Builder — scope, compile, PDF. |
| `sop-builder.html` | SOP Builder — manual or AI-generated SOPs, PDF. |
| `case-study.html` | Case study generator (BYOK Gemini), PDF. |
| `document-engine.html` | Document Engine — SOW / Tax Invoice with line items and deterministic math; Save to Invoices. |
| `invoice-dashboard.html` | Invoice Dashboard — Total Initiated / Received, list of invoices, Mark Received, Print PDF. |
| `lead-intake.html` | Lead Intake AI Agent — SDR-style chat (BYOK Gemini). |
| `margin-audit.html` | Margin Defender — scope risk audit (BYOK Gemini). |

**API routes (all under same server):**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/leads` | GET | List all leads. |
| `/api/leads/bulk` | POST | Bulk upload leads (CSV). |
| `/api/leads/:id/status` | PUT | Update lead status or advance stage. |
| `/api/compile-sow` | POST | Compile markdown SOW + optional AI summary. |
| `/api/generate-casestudy` | POST | Generate case study (BYOK). |
| `/api/generate-sop` | POST | Generate SOP (BYOK). |
| `/api/lead-intake/chat` | POST | Lead intake chat turn (BYOK). |
| `/api/margin-audit` | POST | Scope risk audit (BYOK). |
| `/api/invoices` | GET / POST | List or create invoices. |
| `/api/invoices/stats` | GET | Total Initiated, Total Received. |
| `/api/invoices/:id/status` | PUT | Set invoice status (e.g. received). |

---

## 8. Using the App (Quick Flow)

**SOW Builder** (`/sow-builder.html`):  
1. Document settings — client, project, agency; optional PDF header/footer and letterhead.  
2. Agency global settings — base rate (₹), tax %, multiplier.  
3. Executive summary — Manual or AI (Gemini API key in UI).  
4. Scope builder — add phases/features.  
5. Compile SOW → Download SOW as PDF.

**CRM** (`/dashboard.html`): Upload CSV or use the pipeline; use card actions for Case Study, SOW, Invoice, SOP; advance stages with → Next.

**Document Engine** (`/document-engine.html`): Toggle SOW or Tax Invoice; fill client, dates, line items; set base rate, multiplier, GST; Save to Database (stores in Invoice Dashboard); Export PDF via print.

**Invoice Dashboard** (`/invoice-dashboard.html`): View Total Initiated and Total Received; mark invoices Received; open Print PDF to re-export from Document Engine.

**Lead Intake** (`/lead-intake.html`): Enter Gemini API key and company/sector; chat to capture project, budget, email; get lead summary at the end.

**Margin Defender** (`/margin-audit.html`): Paste scope text; enter API key; Run Audit for risk report; Export PDF or Copy.

---

## 9. Troubleshooting

| Issue | What to do |
|-------|------------|
| **`command not found: node`** | Install Node.js 18+ from [nodejs.org](https://nodejs.org/) or your package manager. |
| **`EADDRINUSE: port 3000`** | Port 3000 is in use. **Kill the process** (see “Stopping the server / freeing port 3000” below) or run on another port (e.g. `PORT=3001 npm start`). |
| **Blank page at localhost:3000** | Ensure you ran `npm start` from the project root and that `public/index.html` exists. |
| **API errors when compiling** | Check `logs/scopesynth.log` for server-side errors. For AI mode, ensure your Gemini API key is valid. |
| **`npm install` fails** | Ensure you have internet access and Node 18+. Try `npm cache clean --force` then `npm install` again. |

---

## 10. Stopping the Server / Freeing Port 3000

- **Same terminal:** In the terminal where the server is running, press **Ctrl + C** to stop it. Then run `npm start` again.
- **Old instance still running / “address already in use”:** If you closed the terminal or the process is still running in the background, kill whatever is using port 3000:

  **macOS / Linux:**
  ```bash
  lsof -ti:3000 | xargs kill -9
  ```
  Or find the PID and kill it:
  ```bash
  lsof -i:3000
  kill -9 <PID>
  ```

  **Windows (PowerShell as Administrator):**
  ```powershell
  Get-NetTCPConnection -LocalPort 3000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
  ```

  Then start the project again with `npm start`. You should see the latest dashboard and server code.

---

For product overview, architecture, and business model, see the main [README](../README.md) in the project root.
