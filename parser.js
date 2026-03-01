/**
 * ScopeSynth OS — SOW Logic Engine
 * Deterministic Markdown → AST → Line-Item Math
 *
 * Depth Rules (unchanged):
 *   depth 0 (Main bullet)     = 10 hrs
 *   depth 1 (Sub-bullet)      =  5 hrs
 *   depth 2 (Sub-sub-bullet)  =  2 hrs
 *
 * Financials (dynamic — driven by config):
 *   effectiveRate = baseRate * multiplier
 *   Subtotal      = totalHours * effectiveRate
 *   Tax           = Subtotal   * (taxRate / 100)
 *   Grand Total   = Subtotal   + Tax
 */

'use strict';

// ─── Depth → Hours (AST rules — untouched) ───────────────────────────────────

const HOURS_BY_DEPTH = {
  0: 10,
  1:  5,
  2:  2,
};

// ─── Parser ──────────────────────────────────────────────────────────────────

/**
 * Detects the indent level of a markdown list line.
 *
 * @param {string} line - A single raw markdown line.
 * @returns {{ depth: number, text: string } | null}
 */
function parseLine(line) {
  const match = line.match(/^(\s*)-\s+(.+)$/);
  if (!match) return null;

  const spaces = match[1].length;
  const text   = match[2].trim();
  const depth  = Math.floor(spaces / 2);

  return { depth, text };
}

/**
 * Builds a flat list of AST nodes from raw markdown text.
 * Each node's lineTotal is computed using the pre-calculated effectiveRate.
 *
 * @param {string} markdown      - Raw nested markdown list string.
 * @param {number} effectiveRate - baseRate * multiplier (resolved before calling).
 * @returns {Array<{ id, depth, text, hours, ratePerHour, lineTotal }>}
 */
function buildAST(markdown, effectiveRate) {
  const lines = markdown.split('\n');
  const nodes = [];
  let   id    = 1;

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) continue;

    const { depth, text } = parsed;
    const hours     = HOURS_BY_DEPTH[depth] ?? HOURS_BY_DEPTH[2];
    const lineTotal = parseFloat((hours * effectiveRate).toFixed(2));

    nodes.push({ id: id++, depth, text, hours, ratePerHour: effectiveRate, lineTotal });
  }

  return nodes;
}

/**
 * Converts a flat AST node list into a nested tree structure.
 * (Untouched — pure structural transform.)
 *
 * @param {Array} nodes - Flat array of AST nodes.
 * @returns {Array}     Nested tree.
 */
function nestAST(nodes) {
  const root  = [];
  const stack = [];

  for (const node of nodes) {
    const entry = { ...node, children: [] };

    while (stack.length && stack[stack.length - 1].depth >= node.depth) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(entry);
    } else {
      stack[stack.length - 1].node.children.push(entry);
    }

    stack.push({ depth: node.depth, node: entry });
  }

  return root;
}

// ─── Financial Calculator ────────────────────────────────────────────────────

/**
 * Computes financial summary from flat AST nodes using dynamic rates.
 *
 * @param {Array}  nodes        - Flat AST nodes (already carry per-node lineTotals).
 * @param {number} effectiveRate - baseRate * multiplier.
 * @param {number} taxRate       - Tax percentage (e.g. 18 for 18%).
 * @returns {{ totalHours, subtotal, tax, grandTotal }}
 */
function calcFinancials(nodes, effectiveRate, taxRate) {
  const totalHours = nodes.reduce((sum, n) => sum + n.hours, 0);
  const subtotal   = parseFloat((totalHours * effectiveRate).toFixed(2));
  const tax        = parseFloat((subtotal * (taxRate / 100)).toFixed(2));
  const grandTotal = parseFloat((subtotal + tax).toFixed(2));

  return { totalHours, subtotal, tax, grandTotal };
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Parses a nested markdown SOW string and returns a full SOW report object.
 *
 * @param {string} markdown   - Raw nested markdown list.
 * @param {object} [config]   - Pricing configuration.
 * @param {number} [config.baseRate=100]    - Base hourly rate in currency units.
 * @param {number} [config.taxRate=18]      - Tax percentage (e.g. 18 for 18%).
 * @param {number} [config.multiplier=1.0]  - Team allocation multiplier.
 * @returns {object} Full SOW report with AST tree, line items, and financials.
 */
function parseMarkdownToSOW(markdown, config = {}) {
  const {
    baseRate   = 100,
    taxRate    = 18,
    multiplier = 1.0,
  } = config;

  const effectiveRate = parseFloat((baseRate * multiplier).toFixed(2));

  const flatNodes  = buildAST(markdown, effectiveRate);
  const tree       = nestAST(flatNodes);
  const financials = calcFinancials(flatNodes, effectiveRate, taxRate);

  return {
    lineItems: flatNodes.map(({ id, depth, text, hours, ratePerHour, lineTotal }) => ({
      id,
      depth,
      text,
      hours,
      ratePerHour,   // effectiveRate per node
      lineTotal,
    })),
    tree,
    financials: {
      totalHours:   financials.totalHours,
      subtotal:     financials.subtotal,
      tax:          financials.tax,
      grandTotal:   financials.grandTotal,
      // Config snapshot — useful for UI display & audit
      baseRate,
      taxRate,
      multiplier,
      effectiveRate,
    },
  };
}

module.exports = { parseMarkdownToSOW };
