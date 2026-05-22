/* Enterprise AI Adoption Dashboard — Main JS */

// ── Chart.js global defaults ──────────────────────────────────────────────────
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = '#334155';
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyleWidth = 10;

const COLORS = {
  blue:   'rgba(59, 130, 246, 0.85)',
  green:  'rgba(16, 185, 129, 0.85)',
  purple: 'rgba(139, 92, 246, 0.85)',
  orange: 'rgba(245, 158, 11, 0.85)',
  red:    'rgba(239, 68, 68, 0.85)',
  cyan:   'rgba(6, 182, 212, 0.85)',
  blueLine:   'rgb(59, 130, 246)',
  greenLine:  'rgb(16, 185, 129)',
  purpleLine: 'rgb(139, 92, 246)',
  orangeLine: 'rgb(245, 158, 11)',
};

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: '#334155', borderWidth: 1, padding: 10 } },
  scales: {
    x: { grid: { color: 'rgba(51,65,85,0.5)' }, ticks: { color: '#94a3b8' } },
    y: { grid: { color: 'rgba(51,65,85,0.5)' }, ticks: { color: '#94a3b8' } },
  }
};

const PIE_OPTS = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', padding: 16 } },
    tooltip: { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: '#334155', borderWidth: 1, padding: 10 }
  }
};

// ── Manual sections config ────────────────────────────────────────────────────
const MANUAL_SECTIONS = {
  bizreq: {
    fields: [
      { key: 'activeUsers',            label: 'BA Users with AI Assist'   },
      { key: 'documentsGenerated',     label: 'Documents Generated'       },
      { key: 'requirementsReviewed',   label: 'Requirements AI-Reviewed'  },
      { key: 'timeSavedHours',         label: 'Est. Time Saved (hrs)'     },
    ]
  },
  solution: {
    fields: [
      { key: 'architectsUsingAI',  label: 'Architects Using AI'         },
      { key: 'designDocuments',    label: 'Design Documents'            },
      { key: 'patternsSuggested',  label: 'Patterns Suggested'          },
      { key: 'reviewsAutomated',   label: 'Reviews Automated (%)'       },
    ]
  },
  qa: {
    fields: [
      { key: 'engineersWithAI',      label: 'QA Engineers with AI'     },
      { key: 'testCasesGenerated',   label: 'Test Cases Generated'     },
      { key: 'defectsCaught',        label: 'Defects Caught by AI'     },
      { key: 'testCoverage',         label: 'Test Coverage (%)'        },
    ]
  },
  prod: {
    fields: [
      { key: 'deploymentsWithAI',      label: 'Deployments with AI Assist' },
      { key: 'meanTimeToDeploy',       label: 'Mean Time to Deploy (min)'  },
      { key: 'rollbacksPrevented',     label: 'Rollbacks Prevented'        },
      { key: 'incidentsAutoResolved',  label: 'Incidents Auto-Resolved'    },
    ]
  },
};

// In-memory copy of manual metrics (loaded from API on init)
let manualMetrics = {};

// Registered Chart.js instances (for destruction on re-render)
const chartRegistry = {};

// ── Tab Switching ─────────────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + target).classList.add('active');
    });
  });
}

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCSV(csv) {
  const lines = csv.trim().split('\n').filter(Boolean);
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
    return obj;
  });
}

// ── Kiro S3 integration ───────────────────────────────────────────────────────

async function initKiro() {
  // 1. Check S3 config status
  await refreshKiroStatus();

  // 2. Populate date selector
  await loadKiroDates();

  // 3. Fetch today's report (or latest)
  await fetchKiroReport();
}

async function refreshKiroStatus() {
  try {
    const status = await fetch('/api/kiro/status').then(r => r.json());
    renderS3StatusBadge(status);
  } catch {
    renderS3StatusBadge({ configured: false, bucket: null, region: 'unknown' });
  }
}

function renderS3StatusBadge(status) {
  const badge  = document.getElementById('s3-status-badge');
  const detail = document.getElementById('s3-status-detail');
  if (!badge) return;

  if (status.connected) {
    // Real HeadBucket succeeded — genuinely reachable
    badge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/25';
    badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-green-400 inline-block"></span> S3 Connected';
    if (detail) detail.textContent = `s3://${status.bucket}/${status.prefix}  ·  ${status.region}`;
  } else if (status.configured) {
    // Bucket name set but HeadBucket failed — wrong bucket, bad creds, network error
    badge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/25';
    badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-400 inline-block"></span> S3 Unreachable';
    if (detail) detail.textContent = `Cannot reach s3://${status.bucket} — check bucket name, credentials, and region. (${status.error || 'connection failed'})  Showing sample CSV fallback.`;
  } else {
    // KIRO_S3_BUCKET not set at all
    badge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/25';
    badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span> S3 Not Configured';
    if (detail) detail.textContent = 'Set KIRO_S3_BUCKET in your .env to enable live data.  Showing sample CSV fallback.';
  }
}

async function loadKiroDates() {
  const sel = document.getElementById('kiro-date-select');
  if (!sel) return;
  try {
    const { dates } = await fetch('/api/kiro/dates').then(r => r.json());
    if (dates && dates.length) {
      sel.innerHTML = dates.map(d => `<option value="${d}">${d}</option>`).join('');
      sel.disabled = false;
    }
  } catch {
    // S3 not configured — leave the selector disabled
  }
}

async function fetchKiroReport(date) {
  setKiroLoading(true);
  try {
    const url = date ? `/api/kiro/report?date=${date}` : '/api/kiro/report';
    const res = await fetch(url);

    if (res.ok) {
      const csv = await res.text();
      const reportDate = res.headers.get('X-Report-Date') || date || 'latest';
      const rows = parseCSV(csv);
      renderKiro(rows, reportDate, 'live');
    } else {
      // API returned an error — fall back to sample data
      const rows = parseCSV(SAMPLE_KIRO_CSV);
      renderKiro(rows, 'sample', 'sample');
    }
  } catch {
    // Network error or server not running — fall back to sample data
    const rows = parseCSV(SAMPLE_KIRO_CSV);
    renderKiro(rows, 'sample', 'sample');
  }
  setKiroLoading(false);
}

function setKiroLoading(loading) {
  const overlay = document.getElementById('kiro-loading');
  if (overlay) overlay.style.display = loading ? 'flex' : 'none';
}

function renderKiro(rows, reportDate, source) {
  // Update report date label
  const label = document.getElementById('kiro-report-date');
  if (label) {
    label.textContent = source === 'sample'
      ? 'Sample Data (S3 not configured)'
      : `Report date: ${reportDate}`;
    label.className = source === 'sample'
      ? 'text-xs text-yellow-400 font-medium'
      : 'text-xs text-green-400 font-medium';
  }

  // Compute summary stats
  const activeDevs  = rows.length;
  const totalMsgs   = rows.reduce((s, r) => s + Number(r.total_messages  || 0), 0);
  const totalCreds  = rows.reduce((s, r) => s + Number(r.credits_used    || 0), 0);
  const avgMsgs     = activeDevs ? Math.round(totalMsgs / activeDevs) : 0;

  setKiroCard('kiro-stat-devs',   activeDevs);
  setKiroCard('kiro-stat-msgs',   totalMsgs);
  setKiroCard('kiro-stat-creds',  totalCreds);
  setKiroCard('kiro-stat-avg',    avgMsgs);

  // Re-render charts
  buildKiroTopUsers(rows);
  buildKiroClientType(rows);
  buildKiroModels(rows);
  buildKiroDailyTrend();
  buildKiroTable(rows);
}

function setKiroCard(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = Number(value).toLocaleString();
}

// ── Kiro charts ───────────────────────────────────────────────────────────────

function buildChart(id, config) {
  if (chartRegistry[id]) chartRegistry[id].destroy();
  const ctx = document.getElementById(id);
  if (!ctx) return;
  chartRegistry[id] = new Chart(ctx, config);
}

function buildKiroTopUsers(rows) {
  const sorted = [...rows].sort((a, b) => Number(b.total_messages) - Number(a.total_messages)).slice(0, 10);
  buildChart('chart-kiro-top-users', {
    type: 'bar',
    data: {
      labels: sorted.map(r => r.user_id),
      datasets: [{ label: 'Messages', data: sorted.map(r => Number(r.total_messages)), backgroundColor: COLORS.blue, borderRadius: 5, borderSkipped: false }]
    },
    options: { ...CHART_OPTS }
  });
}

function buildKiroClientType(rows) {
  const counts = {};
  rows.forEach(r => { counts[r.client_type] = (counts[r.client_type] || 0) + Number(r.total_messages); });
  const labels = Object.keys(counts);
  buildChart('chart-kiro-client', {
    type: 'doughnut',
    data: { labels, datasets: [{ data: labels.map(k => counts[k]), backgroundColor: [COLORS.blue, COLORS.green, COLORS.purple, COLORS.orange], borderWidth: 2, borderColor: '#1e293b' }] },
    options: { ...PIE_OPTS, cutout: '65%' }
  });
}

function buildKiroModels(rows) {
  const sonnet = rows.reduce((s, r) => s + Number(r.model_claude_sonnet || 0), 0);
  const haiku  = rows.reduce((s, r) => s + Number(r.model_claude_haiku  || 0), 0);
  const opus   = rows.reduce((s, r) => s + Number(r.model_claude_opus   || 0), 0);
  buildChart('chart-kiro-models', {
    type: 'bar',
    data: {
      labels: ['Claude Sonnet', 'Claude Haiku', 'Claude Opus'],
      datasets: [{ label: 'Messages', data: [sonnet, haiku, opus], backgroundColor: [COLORS.blue, COLORS.green, COLORS.purple], borderRadius: 6, borderSkipped: false }]
    },
    options: { ...CHART_OPTS }
  });
}

function buildKiroDailyTrend() {
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const base = [320,410,380,450,490,510,530,480,520,560,590,610,580,620,640,660,630,670,700,720,710,730,750,770,760,780,800,820,810,834];
  buildChart('chart-kiro-daily', {
    type: 'line',
    data: {
      labels: days,
      datasets: [{
        label: 'Total Messages',
        data: base,
        borderColor: COLORS.blueLine,
        backgroundColor: 'rgba(59,130,246,0.1)',
        fill: true, tension: 0.4, pointRadius: 2, pointHoverRadius: 5
      }]
    },
    options: { ...CHART_OPTS, plugins: { ...CHART_OPTS.plugins, legend: { display: false } } }
  });
}

function buildKiroTable(rows) {
  const tbody = document.getElementById('kiro-table-body');
  if (!tbody) return;
  const icon = { vscode: '💻', cli: '⌨️', jetbrains: '🧩', web: '🌐' };
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td class="font-mono text-xs text-slate-400">${r.user_id}</td>
      <td>${icon[r.client_type] || ''} ${r.client_type}</td>
      <td><span class="badge badge-enterprise">${r.subscription_tier}</span></td>
      <td class="text-right font-mono">${Number(r.total_messages).toLocaleString()}</td>
      <td class="text-right font-mono">${Number(r.credits_used).toLocaleString()}</td>
      <td class="text-right font-mono">${Number(r.model_claude_sonnet || 0).toLocaleString()}</td>
      <td class="text-right font-mono">${Number(r.model_claude_haiku  || 0).toLocaleString()}</td>
    </tr>`).join('');
}

// ── Manual input — edit forms ─────────────────────────────────────────────────

function initEditForms() {
  Object.entries(MANUAL_SECTIONS).forEach(([section, cfg]) => {
    const panel = document.getElementById(`panel-${section}`);
    if (!panel) return;

    // Inject edit button into the panel header area
    const header = panel.querySelector('.manual-edit-header');
    if (!header) return;

    const btn = document.createElement('button');
    btn.id = `edit-btn-${section}`;
    btn.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors';
    btn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> Edit Metrics';
    btn.onclick = () => toggleEditPanel(section);
    header.appendChild(btn);

    // Build edit form panel
    const formEl = document.createElement('div');
    formEl.id = `edit-panel-${section}`;
    formEl.className = 'card p-5 mb-5 hidden';
    formEl.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm font-semibold text-slate-200">Edit KPI Metrics</p>
        <p class="text-xs text-slate-500">Changes are saved to the server and persist across reloads.</p>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        ${cfg.fields.map(f => `
          <div>
            <label class="block text-xs text-slate-400 mb-1">${f.label}</label>
            <input id="edit-${section}-${f.key}" type="number" min="0"
              class="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white
                     focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40"
              value="${(manualMetrics[section] || {})[f.key] || 0}" />
          </div>`).join('')}
      </div>
      <div class="flex gap-2">
        <button onclick="saveManualSection('${section}')"
          class="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors">
          Save
        </button>
        <button onclick="toggleEditPanel('${section}')"
          class="px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
          Cancel
        </button>
        <span id="edit-status-${section}" class="text-xs text-slate-500 self-center ml-2"></span>
      </div>`;

    // Insert before the stat cards grid
    const firstGrid = panel.querySelector('.grid');
    if (firstGrid) panel.insertBefore(formEl, firstGrid);
  });
}

function toggleEditPanel(section) {
  const panel = document.getElementById(`edit-panel-${section}`);
  if (!panel) return;
  const isHidden = panel.classList.contains('hidden');
  if (isHidden) {
    // Refresh inputs with current values before showing
    const sec = MANUAL_SECTIONS[section];
    sec.fields.forEach(f => {
      const inp = document.getElementById(`edit-${section}-${f.key}`);
      if (inp) inp.value = (manualMetrics[section] || {})[f.key] || 0;
    });
  }
  panel.classList.toggle('hidden');
}

async function saveManualSection(section) {
  const sec = MANUAL_SECTIONS[section];
  const updated = {};
  sec.fields.forEach(f => {
    const inp = document.getElementById(`edit-${section}-${f.key}`);
    updated[f.key] = inp ? Number(inp.value) : 0;
  });

  const statusEl = document.getElementById(`edit-status-${section}`);

  try {
    const payload = { ...manualMetrics, [section]: updated };
    const res = await fetch('/api/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { data } = await res.json();
    manualMetrics = data;
    applyManualMetrics();
    if (statusEl) { statusEl.textContent = '✓ Saved'; statusEl.className = 'text-xs text-green-400 self-center ml-2'; }
    setTimeout(() => { if (statusEl) statusEl.textContent = ''; toggleEditPanel(section); }, 1200);
  } catch (err) {
    if (statusEl) { statusEl.textContent = `✗ ${err.message}`; statusEl.className = 'text-xs text-red-400 self-center ml-2'; }
  }
}

async function loadManualMetrics() {
  try {
    manualMetrics = await fetch('/api/manual').then(r => r.json());
  } catch {
    // Server not running — use defaults (shown in HTML already)
    manualMetrics = {
      bizreq:   { activeUsers: 48,  documentsGenerated: 312, requirementsReviewed: 1840, timeSavedHours: 920  },
      solution: { architectsUsingAI: 29, designDocuments: 156, patternsSuggested: 284, reviewsAutomated: 68  },
      qa:       { engineersWithAI: 38,   testCasesGenerated: 780, defectsCaught: 284,   testCoverage: 84     },
      prod:     { deploymentsWithAI: 88, meanTimeToDeploy: 12, rollbacksPrevented: 14, incidentsAutoResolved: 32 },
    };
  }
  applyManualMetrics();
}

function applyManualMetrics() {
  // Update all [data-metric-section][data-metric-key] elements
  document.querySelectorAll('[data-metric-section]').forEach(container => {
    const section = container.dataset.metricSection;
    const data = manualMetrics[section];
    if (!data) return;
    container.querySelectorAll('[data-metric-key]').forEach(el => {
      const val = data[el.dataset.metricKey];
      if (val !== undefined) el.textContent = Number(val).toLocaleString();
    });
  });
}

// ── Overview charts ───────────────────────────────────────────────────────────

function chartSdlcAdoption() {
  buildChart('chart-sdlc-adoption', {
    type: 'bar',
    data: {
      labels: ['Production Deployment', 'QA / Testing', 'Development (Kiro)', 'Solution Design', 'Business Requirements'],
      datasets: [{ label: 'Adoption %', data: [42, 58, 78, 51, 65], backgroundColor: [COLORS.cyan, COLORS.green, COLORS.blue, COLORS.purple, COLORS.orange], borderRadius: 6, borderSkipped: false }]
    },
    options: {
      ...CHART_OPTS, indexAxis: 'y',
      plugins: { ...CHART_OPTS.plugins, legend: { display: false }, tooltip: { ...CHART_OPTS.plugins.tooltip, callbacks: { label: c => ` ${c.raw}% of eligible users` } } },
      scales: { x: { ...CHART_OPTS.scales.x, min: 0, max: 100, ticks: { ...CHART_OPTS.scales.x.ticks, callback: v => v + '%' } }, y: { ...CHART_OPTS.scales.y, grid: { display: false } } }
    }
  });
}

function chartMonthlyTrend() {
  buildChart('chart-monthly-trend', {
    type: 'line',
    data: {
      labels: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'],
      datasets: [
        { label: 'Kiro (Dev)',      data: [38,45,55,62,71,78], borderColor: COLORS.blueLine,   backgroundColor: 'rgba(59,130,246,0.1)',  fill:true, tension:0.4, pointRadius:4 },
        { label: 'Biz Req',        data: [20,28,35,45,58,65], borderColor: COLORS.orangeLine,  backgroundColor: 'rgba(245,158,11,0.08)', fill:true, tension:0.4, pointRadius:4 },
        { label: 'Solution Design', data: [15,22,30,38,45,51], borderColor: COLORS.purpleLine, backgroundColor: 'rgba(139,92,246,0.08)', fill:true, tension:0.4, pointRadius:4 },
        { label: 'QA',             data: [10,18,28,38,50,58], borderColor: COLORS.greenLine,   backgroundColor: 'rgba(16,185,129,0.08)', fill:true, tension:0.4, pointRadius:4 },
      ]
    },
    options: {
      ...CHART_OPTS,
      plugins: { ...CHART_OPTS.plugins, legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', padding: 16 } } },
      scales: { x: { ...CHART_OPTS.scales.x }, y: { ...CHART_OPTS.scales.y, min: 0, max: 100, ticks: { ...CHART_OPTS.scales.y.ticks, callback: v => v + '%' } } }
    }
  });
}

// ── Biz Req charts ────────────────────────────────────────────────────────────

function chartBizQuality() {
  buildChart('chart-biz-quality', {
    type: 'bar',
    data: {
      labels: ['Completeness','Clarity','Testability','Consistency','Coverage'],
      datasets: [
        { label: 'Before AI', data: [62,58,55,60,54], backgroundColor: 'rgba(100,116,139,0.7)', borderRadius: 4 },
        { label: 'After AI',  data: [88,85,82,87,84], backgroundColor: COLORS.orange,           borderRadius: 4 },
      ]
    },
    options: {
      ...CHART_OPTS,
      plugins: { ...CHART_OPTS.plugins, legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', padding: 16 } } },
      scales: { x: { ...CHART_OPTS.scales.x }, y: { ...CHART_OPTS.scales.y, min: 0, max: 100 } }
    }
  });
}

function chartBizTools() {
  buildChart('chart-biz-tools', {
    type: 'bar',
    data: {
      labels: ['Claude','GitHub Copilot','Gemini','ChatGPT','Jira AI'],
      datasets: [{ label: 'Users', data: [48,35,22,18,30], backgroundColor: [COLORS.orange,COLORS.blue,COLORS.cyan,COLORS.green,COLORS.purple], borderRadius: 5, borderSkipped: false }]
    },
    options: { ...CHART_OPTS, indexAxis: 'y', scales: { x: { ...CHART_OPTS.scales.x }, y: { ...CHART_OPTS.scales.y, grid: { display: false } } } }
  });
}

// ── Solution Design charts ────────────────────────────────────────────────────

function chartSolutionRadar() {
  buildChart('chart-solution-radar', {
    type: 'radar',
    data: {
      labels: ['Completeness','Consistency','Security','Scalability','Cost Optimisation'],
      datasets: [
        { label: 'Without AI', data: [60,55,65,58,52], borderColor: 'rgba(100,116,139,0.8)', backgroundColor: 'rgba(100,116,139,0.15)', pointBackgroundColor: 'rgba(100,116,139,0.8)' },
        { label: 'With AI',    data: [87,83,89,85,80], borderColor: COLORS.purpleLine,        backgroundColor: 'rgba(139,92,246,0.15)',  pointBackgroundColor: COLORS.purpleLine },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', padding: 16 } }, tooltip: PIE_OPTS.plugins.tooltip },
      scales: { r: { grid: { color: 'rgba(51,65,85,0.6)' }, ticks: { color: '#475569', backdropColor: 'transparent', stepSize: 20 }, pointLabels: { color: '#94a3b8', font: { size: 12 } }, min: 0, max: 100 } }
    }
  });
}

function chartSolutionArtifacts() {
  buildChart('chart-solution-artifacts', {
    type: 'bar',
    data: {
      labels: ['Dec','Jan','Feb','Mar','Apr','May'],
      datasets: [
        { label: 'Architecture Docs', data: [8,11,14,18,22,26],  backgroundColor: COLORS.purple, borderRadius: 4 },
        { label: 'ADRs',              data: [5,7,9,12,15,18],   backgroundColor: COLORS.cyan,   borderRadius: 4 },
        { label: 'Diagrams',          data: [12,16,20,25,30,36], backgroundColor: COLORS.blue,   borderRadius: 4 },
      ]
    },
    options: { ...CHART_OPTS, plugins: { ...CHART_OPTS.plugins, legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', padding: 16 } } } }
  });
}

// ── QA charts ─────────────────────────────────────────────────────────────────

function chartQATestCases() {
  buildChart('chart-qa-testcases', {
    type: 'line',
    data: {
      labels: ['Dec','Jan','Feb','Mar','Apr','May'],
      datasets: [
        { label: 'AI-Generated', data: [120,210,350,480,620,780], borderColor: COLORS.greenLine, backgroundColor: 'rgba(16,185,129,0.1)', fill:true, tension:0.4, pointRadius:4 },
        { label: 'Manual',       data: [850,820,780,740,700,660], borderColor: 'rgba(100,116,139,0.8)', backgroundColor: 'rgba(100,116,139,0.08)', fill:true, tension:0.4, pointRadius:4 },
      ]
    },
    options: { ...CHART_OPTS, plugins: { ...CHART_OPTS.plugins, legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', padding: 16 } } } }
  });
}

function chartQATypes() {
  buildChart('chart-qa-types', {
    type: 'doughnut',
    data: { labels: ['Unit','Integration','E2E','Performance','Security'], datasets: [{ data: [35,28,20,10,7], backgroundColor: [COLORS.blue,COLORS.green,COLORS.purple,COLORS.orange,COLORS.red], borderWidth: 2, borderColor: '#1e293b' }] },
    options: { ...PIE_OPTS, cutout: '60%' }
  });
}

function chartQADefects() {
  buildChart('chart-qa-defects', {
    type: 'bar',
    data: {
      labels: ['Critical','High','Medium','Low'],
      datasets: [
        { label: 'Caught by AI', data: [18,45,87,134], backgroundColor: COLORS.green, borderRadius: 4 },
        { label: 'Missed',       data: [3,8,22,41],    backgroundColor: COLORS.red,   borderRadius: 4 },
      ]
    },
    options: { ...CHART_OPTS, plugins: { ...CHART_OPTS.plugins, legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', padding: 16 } } } }
  });
}

// ── Production charts ─────────────────────────────────────────────────────────

function chartProdFrequency() {
  const weeks = ['W1 Feb','W2 Feb','W3 Feb','W4 Feb','W1 Mar','W2 Mar','W3 Mar','W4 Mar','W1 Apr','W2 Apr','W3 Apr','W4 Apr','W1 May','W2 May','W3 May'];
  buildChart('chart-prod-frequency', {
    type: 'line',
    data: { labels: weeks, datasets: [{ label: 'Deployments/week', data: [8,9,10,9,11,12,13,12,14,15,16,15,17,18,20], borderColor: 'rgb(6,182,212)', backgroundColor: 'rgba(6,182,212,0.1)', fill: true, tension: 0.4, pointRadius: 3 }] },
    options: { ...CHART_OPTS, plugins: { ...CHART_OPTS.plugins, legend: { display: false } } }
  });
}

function chartProdAIvsManual() {
  buildChart('chart-prod-ai-manual', {
    type: 'bar',
    data: {
      labels: ['Dec','Jan','Feb','Mar','Apr','May'],
      datasets: [
        { label: 'AI-Assisted', data: [18,28,42,58,72,88], backgroundColor: COLORS.cyan,                    borderRadius: 4 },
        { label: 'Manual',      data: [82,75,65,55,42,32], backgroundColor: 'rgba(100,116,139,0.7)', borderRadius: 4 },
      ]
    },
    options: { ...CHART_OPTS, plugins: { ...CHART_OPTS.plugins, legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', padding: 16 } } } }
  });
}

function chartProdSuccessRate() {
  buildChart('chart-prod-success', {
    type: 'doughnut',
    data: { labels: ['Success','Failed'], datasets: [{ data: [97,3], backgroundColor: [COLORS.green, COLORS.red], borderWidth: 2, borderColor: '#1e293b' }] },
    options: { ...PIE_OPTS, cutout: '72%' }
  });
}

// ── Animated counters ─────────────────────────────────────────────────────────
function initCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const obs = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      obs.disconnect();
      const start = performance.now();
      const duration = 1200;
      const tick = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.floor(eased * target).toLocaleString() + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    obs.observe(el);
  });
}

// ── Sample fallback CSV (used when S3 is not configured) ──────────────────────
const SAMPLE_KIRO_CSV = `date,user_id,client_type,subscription_tier,total_messages,credits_used,model_claude_sonnet,model_claude_haiku,model_claude_opus
2026-05-21,usr_001,vscode,enterprise,342,1024,280,62,0
2026-05-21,usr_002,cli,enterprise,198,594,120,78,0
2026-05-21,usr_003,vscode,enterprise,415,1245,390,25,0
2026-05-21,usr_004,jetbrains,enterprise,287,861,210,77,0
2026-05-21,usr_005,web,enterprise,156,468,100,56,0
2026-05-21,usr_006,vscode,enterprise,523,1569,480,43,0
2026-05-21,usr_007,cli,enterprise,89,267,60,29,0
2026-05-21,usr_008,vscode,enterprise,634,1902,580,54,0
2026-05-21,usr_009,jetbrains,enterprise,211,633,160,51,0
2026-05-21,usr_010,vscode,enterprise,378,1134,320,58,0
2026-05-21,usr_011,web,enterprise,143,429,90,53,0
2026-05-21,usr_012,cli,enterprise,265,795,200,65,0
2026-05-21,usr_013,vscode,enterprise,489,1467,440,49,0
2026-05-21,usr_014,jetbrains,enterprise,332,996,270,62,0
2026-05-21,usr_015,vscode,enterprise,401,1203,350,51,0
2026-05-21,usr_016,web,enterprise,178,534,120,58,0
2026-05-21,usr_017,cli,enterprise,234,702,180,54,0
2026-05-21,usr_018,vscode,enterprise,567,1701,510,57,0
2026-05-21,usr_019,jetbrains,enterprise,298,894,240,58,0
2026-05-21,usr_020,vscode,enterprise,445,1335,400,45,0`;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  initCounters();

  // Static/illustrative charts (Overview + non-Kiro tabs)
  chartSdlcAdoption();
  chartMonthlyTrend();
  chartBizQuality();
  chartBizTools();
  chartSolutionRadar();
  chartSolutionArtifacts();
  chartQATestCases();
  chartQATypes();
  chartQADefects();
  chartProdFrequency();
  chartProdAIvsManual();
  chartProdSuccessRate();

  // Manual metrics: load from API then wire up edit forms
  await loadManualMetrics();
  initEditForms();

  // Kiro: fetch live from S3 via server API
  await initKiro();

  // Date picker change handler
  const dateSel = document.getElementById('kiro-date-select');
  if (dateSel) dateSel.addEventListener('change', () => fetchKiroReport(dateSel.value));
});
