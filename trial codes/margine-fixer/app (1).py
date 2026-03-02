"""
Margin Defender AI — Internal Scope Audit Agent
LangGraph-powered analysis tool using Google Gemini 2.5 Flash
"""
import os
import json
import logging
from typing import Annotated
from typing_extensions import TypedDict
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
import uvicorn
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()

# ── Logging ─────────────────────────────────────────────────────────────────
log_dir = Path(__file__).parent.parent / "logs"
log_dir.mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    handlers=[
        logging.FileHandler(log_dir / "margin-defender.json"),
        logging.StreamHandler()
    ],
    format='{"time":"%(asctime)s","level":"%(levelname)s","msg":"%(message)s"}'
)
logger = logging.getLogger("margin-defender")

# ── LangGraph State ─────────────────────────────────────────────────────────
class AuditState(TypedDict):
    messages: Annotated[list, add_messages]
    scope_text: str
    risk_report: str
    status: str  # idle | analyzing | done | error

# ── LLM ─────────────────────────────────────────────────────────────────────
def get_llm():
    api_key = os.getenv("GEMINI_API_KEY", "")
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=api_key,
        temperature=0.3,
    )

AUDIT_SYSTEM_PROMPT = """You are the Margin Defender — a ruthless, veteran scope auditor for Fi Techs, a premium AI agency.
Your job is to protect the agency's profit margins by identifying every risk in a project scope.
You are direct, specific, and unsparing. You have seen hundreds of projects fail due to vague scopes.
You output structured, actionable risk reports.
Agency context: Fi Techs builds AI agents, SaaS platforms, enterprise automation. Pricing is in ₹."""

def analyze_node(state: AuditState) -> AuditState:
    """Runs deep scope analysis and generates the risk report."""
    llm = get_llm()
    scope_text = state["scope_text"]

    prompt = f"""Analyze the following project scope for margin bleed risks.

SCOPE TO AUDIT:
\"\"\"
{scope_text}
\"\"\"

Generate a ruthless Risk Report with EXACTLY this structure:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ MARGIN DEFENDER — RISK AUDIT REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 OVERALL RISK SCORE: [X/10]
🔴 RISK LEVEL: [CRITICAL / HIGH / MEDIUM / LOW]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ CRITICAL WARNINGS:

🔴 WARNING 1: [Title]
   → Issue: [Specific vague or risky wording quoted from scope]
   → Margin Risk: [Exact risk — e.g., "Unlimited revisions could add ₹80,000+ in labor"]
   → Fix: [Precise contractual language to use instead]

🔴 WARNING 2: [Title]
   → Issue: [...]
   → Margin Risk: [...]
   → Fix: [...]

🔴 WARNING 3: [Title]
   → Issue: [...]
   → Margin Risk: [...]
   → Fix: [...]

[Add WARNING 4 and WARNING 5 only if genuinely critical risks exist]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 SCOPE HEALTH SUMMARY:
[2-3 sentence overall assessment of the scope quality and the biggest financial exposure]

✅ TOP 3 PROTECTIVE CLAUSES TO ADD:
1. [Specific clause]
2. [Specific clause]
3. [Specific clause]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Audited by Margin Defender AI | Fi Techs © 2026"""

    system_msg = SystemMessage(content=AUDIT_SYSTEM_PROMPT)
    messages = [system_msg, HumanMessage(content=prompt)]

    try:
        response = llm.invoke(messages)
        logger.info(f"audit_complete scope_len={len(scope_text)} report_len={len(response.content)}")
        return {
            "messages": [AIMessage(content=response.content)],
            "scope_text": scope_text,
            "risk_report": response.content,
            "status": "done"
        }
    except Exception as e:
        logger.error(f"analysis_error={str(e)}")
        return {
            "messages": [],
            "scope_text": scope_text,
            "risk_report": f"Analysis failed: {str(e)}",
            "status": "error"
        }

def validate_node(state: AuditState) -> AuditState:
    """Validates that the scope is substantial enough to analyze."""
    scope = state["scope_text"].strip()
    if len(scope) < 50:
        return {
            "messages": [],
            "scope_text": scope,
            "risk_report": "⚠️ Scope too short. Please provide at least 50 characters of project scope for meaningful analysis.",
            "status": "error"
        }
    return {**state, "status": "analyzing"}

def route_after_validate(state: AuditState) -> str:
    return "analyze" if state["status"] == "analyzing" else END

# ── Build Graph ──────────────────────────────────────────────────────────────
def build_audit_graph():
    graph = StateGraph(AuditState)
    graph.add_node("validate", validate_node)
    graph.add_node("analyze", analyze_node)
    graph.set_entry_point("validate")
    graph.add_conditional_edges("validate", route_after_validate, {"analyze": "analyze", END: END})
    graph.add_edge("analyze", END)
    return graph.compile()

audit_graph = build_audit_graph()

# ── FastAPI App ──────────────────────────────────────────────────────────────
app = FastAPI(title="Margin Defender AI")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Margin Defender AI | Fi Techs</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0f172a;color:#e2e8f0;font-family:'Segoe UI',system-ui,sans-serif;min-height:100vh;display:flex;flex-direction:column}
  header{background:#1e293b;border-bottom:1px solid #334155;padding:16px 24px;display:flex;align-items:center;gap:12px}
  header .logo{width:36px;height:36px;background:#e11d48;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#fff}
  header h1{font-size:18px;font-weight:700;color:#f1f5f9}
  header span{font-size:12px;color:#94a3b8;margin-left:4px}
  .badge{background:#e11d4820;color:#e11d48;border:1px solid #e11d4840;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;margin-left:auto}
  .internal-badge{background:#7c3aed20;color:#a78bfa;border:1px solid #7c3aed40;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;margin-left:8px}
  main{flex:1;padding:32px 24px;max-width:900px;margin:0 auto;width:100%;display:flex;flex-direction:column;gap:24px}
  .panel{background:#1e293b;border:1px solid #334155;border-radius:14px;padding:24px}
  .panel h2{font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:16px;display:flex;align-items:center;gap:8px}
  .panel h2 .icon{font-size:18px}
  label{font-size:13px;color:#94a3b8;display:block;margin-bottom:8px;font-weight:500}
  textarea{width:100%;background:#0f172a;border:1px solid #334155;border-radius:10px;padding:14px 16px;color:#e2e8f0;font-size:13px;line-height:1.7;outline:none;resize:vertical;min-height:200px;font-family:inherit;transition:border .2s}
  textarea:focus{border-color:#e11d48}
  textarea::placeholder{color:#475569}
  .btn-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
  .btn-primary{background:#e11d48;color:#fff;border:none;border-radius:10px;padding:13px 28px;font-size:14px;font-weight:700;cursor:pointer;transition:background .2s;display:flex;align-items:center;gap:8px}
  .btn-primary:hover{background:#be123c}
  .btn-primary:disabled{background:#334155;color:#64748b;cursor:not-allowed}
  .btn-secondary{background:transparent;color:#94a3b8;border:1px solid #334155;border-radius:10px;padding:13px 20px;font-size:14px;cursor:pointer;transition:all .2s}
  .btn-secondary:hover{border-color:#e11d48;color:#e11d48}
  .char-count{font-size:12px;color:#64748b;margin-left:auto}
  #result{display:none}
  .risk-score-bar{display:flex;align-items:center;gap:16px;background:#0f172a;border:1px solid #334155;border-radius:10px;padding:16px;margin-bottom:20px}
  .risk-score-bar .score{font-size:32px;font-weight:800;color:#e11d48}
  .risk-score-bar .label{font-size:13px;color:#94a3b8}
  pre{background:#0f172a;border:1px solid #334155;border-radius:10px;padding:20px;font-size:13px;line-height:1.8;white-space:pre-wrap;font-family:'Cascadia Code','Fira Code',monospace;color:#e2e8f0;overflow-x:auto}
  .loader{display:none;flex-direction:column;align-items:center;gap:12px;padding:40px}
  .loader .spinner{width:40px;height:40px;border:3px solid #334155;border-top-color:#e11d48;border-radius:50%;animation:spin 0.8s linear infinite}
  .loader p{color:#94a3b8;font-size:14px}
  @keyframes spin{to{transform:rotate(360deg)}}
  .export-btn{background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:10px 18px;font-size:13px;cursor:pointer;transition:all .2s}
  .export-btn:hover{border-color:#e11d48;color:#e11d48}
  @media print{
    header,#input-panel,.btn-row,footer{display:none!important}
    body{background:#fff;color:#000}
    pre{background:#f8f8f8;color:#000;border:1px solid #ddd}
  }
</style>
</head>
<body>
<header>
  <div class="logo">MD</div>
  <div>
    <h1>Margin Defender AI <span>by Fi Techs</span></h1>
  </div>
  <div class="badge">🤖 Gemini 2.5 Flash</div>
  <div class="internal-badge">🔒 Internal Tool</div>
</header>

<main>
  <div class="panel" id="input-panel">
    <h2><span class="icon">📋</span> Paste Your Draft Scope</h2>
    <label>Enter the project scope, SOW, or client brief you want to audit for margin bleed risks:</label>
    <textarea id="scope" placeholder="E.g.: We need a full-stack web application with user authentication, dashboard, and 'unlimited' customization. The project should be delivered ASAP with full support included. We expect the design to be 'modern and clean' with all necessary integrations..."></textarea>
    <div style="display:flex;align-items:center;gap:8px;margin-top:10px;margin-bottom:16px">
      <span class="char-count" id="char-count">0 characters</span>
    </div>
    <div class="btn-row">
      <button class="btn-primary" id="analyze-btn">
        <span>🛡️</span> Run Audit
      </button>
      <button class="btn-secondary" id="clear-btn">Clear</button>
      <span style="font-size:12px;color:#475569;margin-left:8px">Analysis takes ~5 seconds</span>
    </div>
  </div>

  <div class="loader" id="loader">
    <div class="spinner"></div>
    <p>Margin Defender is analyzing your scope...</p>
    <p style="font-size:12px;color:#475569">Scanning for vague requirements, scope creep, and margin bleed risks</p>
  </div>

  <div class="panel" id="result">
    <h2><span class="icon">🛡️</span> Risk Audit Report
      <button class="export-btn" style="margin-left:auto" onclick="window.print()">🖨️ Export PDF</button>
      <button class="export-btn" onclick="copyReport()">📋 Copy</button>
    </h2>
    <pre id="report-text"></pre>
  </div>
</main>

<script>
  const scopeEl = document.getElementById('scope');
  const charCount = document.getElementById('char-count');
  const analyzeBtn = document.getElementById('analyze-btn');
  const clearBtn = document.getElementById('clear-btn');
  const loader = document.getElementById('loader');
  const result = document.getElementById('result');
  const reportText = document.getElementById('report-text');

  scopeEl.addEventListener('input', () => {
    charCount.textContent = scopeEl.value.length + ' characters';
  });

  clearBtn.addEventListener('click', () => {
    scopeEl.value = '';
    charCount.textContent = '0 characters';
    result.style.display = 'none';
    loader.style.display = 'none';
    analyzeBtn.disabled = false;
  });

  analyzeBtn.addEventListener('click', async () => {
    const scope = scopeEl.value.trim();
    if (!scope) { alert('Please paste a scope to audit.'); return; }
    analyzeBtn.disabled = true;
    result.style.display = 'none';
    loader.style.display = 'flex';

    try {
      const r = await fetch('/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope })
      });
      const data = await r.json();
      loader.style.display = 'none';
      reportText.textContent = data.report;
      result.style.display = 'block';
      result.scrollIntoView({ behavior: 'smooth' });
    } catch(e) {
      loader.style.display = 'none';
      alert('Analysis failed. Check your connection and API key.');
    }
    analyzeBtn.disabled = false;
  });

  function copyReport() {
    navigator.clipboard.writeText(reportText.textContent);
    alert('Report copied to clipboard!');
  }

  // Allow Ctrl+Enter to analyze
  scopeEl.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') analyzeBtn.click();
  });
</script>
</body>
</html>"""

@app.get("/", response_class=HTMLResponse)
async def index():
    return HTML

@app.post("/analyze")
async def analyze(payload: dict):
    scope_text = payload.get("scope", "").strip()
    logger.info(f"analyze_request scope_len={len(scope_text)}")

    initial_state: AuditState = {
        "messages": [],
        "scope_text": scope_text,
        "risk_report": "",
        "status": "idle"
    }

    result = audit_graph.invoke(initial_state)
    return {
        "report": result["risk_report"],
        "status": result["status"]
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 3005))
    logger.info(f"Starting Margin Defender AI on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
