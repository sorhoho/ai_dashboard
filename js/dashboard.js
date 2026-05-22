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

// ── Kiro CSV Parser & Table ───────────────────────────────────────────────────
const KIRO_CSV = `date,user_id,client_type,subscription_tier,total_messages,credits_used,model_claude_sonnet,model_claude_haiku,model_claude_opus
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

function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = vals[i] ? vals[i].trim() : ''; });
    return obj;
  });
}

function buildKiroTable(rows) {
  const tbody = document.getElementById('kiro-table-body');
  if (!tbody) return;
  const clientIcon = { vscode: '💻', cli: '⌨️', jetbrains: '🧩', web: '🌐' };
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td class="font-mono text-xs text-slate-400">${r.user_id}</td>
      <td>${clientIcon[r.client_type] || ''} ${r.client_type}</td>
      <td><span class="badge badge-enterprise">${r.subscription_tier}</span></td>
      <td class="text-right font-mono">${Number(r.total_messages).toLocaleString()}</td>
      <td class="text-right font-mono">${Number(r.credits_used).toLocaleString()}</td>
      <td class="text-right font-mono">${Number(r.model_claude_sonnet).toLocaleString()}</td>
      <td class="text-right font-mono">${Number(r.model_claude_haiku).toLocaleString()}</td>
    </tr>`).join('');
}

// ── Charts ────────────────────────────────────────────────────────────────────

// Overview: SDLC Adoption horizontal bar
function chartSdlcAdoption() {
  const ctx = document.getElementById('chart-sdlc-adoption');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Production Deployment', 'QA / Testing', 'Development (Kiro)', 'Solution Design', 'Business Requirements'],
      datasets: [{
        label: 'Adoption %',
        data: [42, 58, 78, 51, 65],
        backgroundColor: [COLORS.cyan, COLORS.green, COLORS.blue, COLORS.purple, COLORS.orange],
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      ...CHART_OPTS,
      indexAxis: 'y',
      plugins: { ...CHART_OPTS.plugins, legend: { display: false }, datalabels: false,
        tooltip: { ...CHART_OPTS.plugins.tooltip, callbacks: { label: ctx => ` ${ctx.raw}% of eligible users` } }
      },
      scales: {
        x: { ...CHART_OPTS.scales.x, min: 0, max: 100, ticks: { ...CHART_OPTS.scales.x.ticks, callback: v => v + '%' } },
        y: { ...CHART_OPTS.scales.y, grid: { display: false } }
      }
    }
  });
}

// Overview: Monthly trend line
function chartMonthlyTrend() {
  const ctx = document.getElementById('chart-monthly-trend');
  if (!ctx) return;
  const months = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        { label: 'Kiro (Dev)', data: [38, 45, 55, 62, 71, 78], borderColor: COLORS.blueLine, backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4, pointRadius: 4 },
        { label: 'Biz Req', data: [20, 28, 35, 45, 58, 65], borderColor: COLORS.orangeLine, backgroundColor: 'rgba(245,158,11,0.08)', fill: true, tension: 0.4, pointRadius: 4 },
        { label: 'Solution Design', data: [15, 22, 30, 38, 45, 51], borderColor: COLORS.purpleLine, backgroundColor: 'rgba(139,92,246,0.08)', fill: true, tension: 0.4, pointRadius: 4 },
        { label: 'QA', data: [10, 18, 28, 38, 50, 58], borderColor: COLORS.greenLine, backgroundColor: 'rgba(16,185,129,0.08)', fill: true, tension: 0.4, pointRadius: 4 },
      ]
    },
    options: {
      ...CHART_OPTS,
      plugins: { ...CHART_OPTS.plugins, legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', padding: 16 } } },
      scales: {
        x: { ...CHART_OPTS.scales.x },
        y: { ...CHART_OPTS.scales.y, min: 0, max: 100, ticks: { ...CHART_OPTS.scales.y.ticks, callback: v => v + '%' } }
      }
    }
  });
}

// Kiro: Top users by messages
function chartKiroTopUsers(rows) {
  const ctx = document.getElementById('chart-kiro-top-users');
  if (!ctx) return;
  const sorted = [...rows].sort((a, b) => Number(b.total_messages) - Number(a.total_messages)).slice(0, 10);
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(r => r.user_id),
      datasets: [{ label: 'Messages', data: sorted.map(r => Number(r.total_messages)), backgroundColor: COLORS.blue, borderRadius: 5, borderSkipped: false }]
    },
    options: { ...CHART_OPTS, plugins: { ...CHART_OPTS.plugins } }
  });
}

// Kiro: Client type doughnut
function chartKiroClientType(rows) {
  const ctx = document.getElementById('chart-kiro-client');
  if (!ctx) return;
  const counts = {};
  rows.forEach(r => { counts[r.client_type] = (counts[r.client_type] || 0) + Number(r.total_messages); });
  const labels = Object.keys(counts);
  const data = labels.map(k => counts[k]);
  const bgColors = [COLORS.blue, COLORS.green, COLORS.purple, COLORS.orange];
  new Chart(ctx, { type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: bgColors, borderWidth: 2, borderColor: '#1e293b' }] }, options: { ...PIE_OPTS, cutout: '65%' } });
}

// Kiro: Model usage bar
function chartKiroModels(rows) {
  const ctx = document.getElementById('chart-kiro-models');
  if (!ctx) return;
  const sonnet = rows.reduce((s, r) => s + Number(r.model_claude_sonnet), 0);
  const haiku  = rows.reduce((s, r) => s + Number(r.model_claude_haiku), 0);
  const opus   = rows.reduce((s, r) => s + Number(r.model_claude_opus), 0);
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Claude Sonnet', 'Claude Haiku', 'Claude Opus'],
      datasets: [{ label: 'Messages', data: [sonnet, haiku, opus], backgroundColor: [COLORS.blue, COLORS.green, COLORS.purple], borderRadius: 6, borderSkipped: false }]
    },
    options: { ...CHART_OPTS }
  });
}

// Kiro: Daily activity trend
function chartKiroDailyTrend() {
  const ctx = document.getElementById('chart-kiro-daily');
  if (!ctx) return;
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date('2026-04-22');
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  const base = [320, 410, 380, 450, 490, 510, 530, 480, 520, 560, 590, 610, 580, 620, 640, 660, 630, 670, 700, 720, 710, 730, 750, 770, 760, 780, 800, 820, 810, 834];
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: days,
      datasets: [{
        label: 'Total Messages',
        data: base.map(v => v + Math.floor(Math.random() * 30)),
        borderColor: COLORS.blueLine,
        backgroundColor: 'rgba(59,130,246,0.1)',
        fill: true, tension: 0.4, pointRadius: 2, pointHoverRadius: 5
      }]
    },
    options: { ...CHART_OPTS, plugins: { ...CHART_OPTS.plugins, legend: { display: false } } }
  });
}

// Business Requirements: Quality score
function chartBizQuality() {
  const ctx = document.getElementById('chart-biz-quality');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Completeness', 'Clarity', 'Testability', 'Consistency', 'Coverage'],
      datasets: [
        { label: 'Before AI', data: [62, 58, 55, 60, 54], backgroundColor: 'rgba(100,116,139,0.7)', borderRadius: 4 },
        { label: 'After AI',  data: [88, 85, 82, 87, 84], backgroundColor: COLORS.orange, borderRadius: 4 },
      ]
    },
    options: {
      ...CHART_OPTS,
      plugins: { ...CHART_OPTS.plugins, legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', padding: 16 } } },
      scales: { x: { ...CHART_OPTS.scales.x }, y: { ...CHART_OPTS.scales.y, min: 0, max: 100 } }
    }
  });
}

// Business Requirements: Tools used
function chartBizTools() {
  const ctx = document.getElementById('chart-biz-tools');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Claude', 'GitHub Copilot', 'Gemini', 'ChatGPT', 'Jira AI'],
      datasets: [{ label: 'Users', data: [48, 35, 22, 18, 30], backgroundColor: [COLORS.orange, COLORS.blue, COLORS.cyan, COLORS.green, COLORS.purple], borderRadius: 5, borderSkipped: false }]
    },
    options: { ...CHART_OPTS, indexAxis: 'y', scales: { x: { ...CHART_OPTS.scales.x }, y: { ...CHART_OPTS.scales.y, grid: { display: false } } } }
  });
}

// Solution Design: Radar
function chartSolutionRadar() {
  const ctx = document.getElementById('chart-solution-radar');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Completeness', 'Consistency', 'Security', 'Scalability', 'Cost Optimisation'],
      datasets: [
        { label: 'Without AI', data: [60, 55, 65, 58, 52], borderColor: 'rgba(100,116,139,0.8)', backgroundColor: 'rgba(100,116,139,0.15)', pointBackgroundColor: 'rgba(100,116,139,0.8)' },
        { label: 'With AI',    data: [87, 83, 89, 85, 80], borderColor: COLORS.purpleLine, backgroundColor: 'rgba(139,92,246,0.15)', pointBackgroundColor: COLORS.purpleLine },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', padding: 16 } }, tooltip: PIE_OPTS.plugins.tooltip },
      scales: { r: { grid: { color: 'rgba(51,65,85,0.6)' }, ticks: { color: '#475569', backdropColor: 'transparent', stepSize: 20 }, pointLabels: { color: '#94a3b8', font: { size: 12 } }, min: 0, max: 100 } }
    }
  });
}

// Solution Design: Monthly artifacts
function chartSolutionArtifacts() {
  const ctx = document.getElementById('chart-solution-artifacts');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'],
      datasets: [
        { label: 'Architecture Docs', data: [8, 11, 14, 18, 22, 26], backgroundColor: COLORS.purple, borderRadius: 4 },
        { label: 'ADRs', data: [5, 7, 9, 12, 15, 18], backgroundColor: COLORS.cyan, borderRadius: 4 },
        { label: 'Diagrams', data: [12, 16, 20, 25, 30, 36], backgroundColor: COLORS.blue, borderRadius: 4 },
      ]
    },
    options: {
      ...CHART_OPTS,
      plugins: { ...CHART_OPTS.plugins, legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', padding: 16 } } }
    }
  });
}

// QA: Test cases generated
function chartQATestCases() {
  const ctx = document.getElementById('chart-qa-testcases');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'],
      datasets: [
        { label: 'AI-Generated', data: [120, 210, 350, 480, 620, 780], borderColor: COLORS.greenLine, backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4, pointRadius: 4 },
        { label: 'Manual',       data: [850, 820, 780, 740, 700, 660], borderColor: 'rgba(100,116,139,0.8)', backgroundColor: 'rgba(100,116,139,0.08)', fill: true, tension: 0.4, pointRadius: 4 },
      ]
    },
    options: {
      ...CHART_OPTS,
      plugins: { ...CHART_OPTS.plugins, legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', padding: 16 } } }
    }
  });
}

// QA: Test types doughnut
function chartQATypes() {
  const ctx = document.getElementById('chart-qa-types');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Unit', 'Integration', 'E2E', 'Performance', 'Security'],
      datasets: [{ data: [35, 28, 20, 10, 7], backgroundColor: [COLORS.blue, COLORS.green, COLORS.purple, COLORS.orange, COLORS.red], borderWidth: 2, borderColor: '#1e293b' }]
    },
    options: { ...PIE_OPTS, cutout: '60%' }
  });
}

// QA: Defects by severity
function chartQADefects() {
  const ctx = document.getElementById('chart-qa-defects');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Critical', 'High', 'Medium', 'Low'],
      datasets: [
        { label: 'Caught by AI', data: [18, 45, 87, 134], backgroundColor: COLORS.green, borderRadius: 4 },
        { label: 'Missed',       data: [3,   8, 22,  41],  backgroundColor: COLORS.red,   borderRadius: 4 },
      ]
    },
    options: {
      ...CHART_OPTS,
      plugins: { ...CHART_OPTS.plugins, legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', padding: 16 } } }
    }
  });
}

// Prod: Deployment frequency
function chartProdFrequency() {
  const ctx = document.getElementById('chart-prod-frequency');
  if (!ctx) return;
  const weeks = ['W1 Feb','W2 Feb','W3 Feb','W4 Feb','W1 Mar','W2 Mar','W3 Mar','W4 Mar','W1 Apr','W2 Apr','W3 Apr','W4 Apr','W1 May','W2 May','W3 May'];
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: weeks,
      datasets: [{
        label: 'Deployments/week',
        data: [8,9,10,9,11,12,13,12,14,15,16,15,17,18,20],
        borderColor: COLORS.cyanLine || 'rgb(6,182,212)',
        backgroundColor: 'rgba(6,182,212,0.1)',
        fill: true, tension: 0.4, pointRadius: 3
      }]
    },
    options: { ...CHART_OPTS, plugins: { ...CHART_OPTS.plugins, legend: { display: false } } }
  });
}

// Prod: AI vs Manual deployments
function chartProdAIvsManual() {
  const ctx = document.getElementById('chart-prod-ai-manual');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'],
      datasets: [
        { label: 'AI-Assisted', data: [18, 28, 42, 58, 72, 88], backgroundColor: COLORS.cyan, borderRadius: 4 },
        { label: 'Manual',      data: [82, 75, 65, 55, 42, 32], backgroundColor: 'rgba(100,116,139,0.7)', borderRadius: 4 },
      ]
    },
    options: {
      ...CHART_OPTS,
      plugins: { ...CHART_OPTS.plugins, legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', padding: 16 } } }
    }
  });
}

// Prod: Success rate doughnut
function chartProdSuccessRate() {
  const ctx = document.getElementById('chart-prod-success');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Success', 'Failed'],
      datasets: [{ data: [97, 3], backgroundColor: [COLORS.green, COLORS.red], borderWidth: 2, borderColor: '#1e293b' }]
    },
    options: { ...PIE_OPTS, cutout: '72%' }
  });
}

// ── Stat Cards (animated counter) ────────────────────────────────────────────
function animateCounter(el, target, suffix = '') {
  const start = 0;
  const duration = 1200;
  const step = (timestamp) => {
    if (!el._startTime) el._startTime = timestamp;
    const progress = Math.min((timestamp - el._startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(eased * target).toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function initCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { animateCounter(el, target, suffix); obs.disconnect(); }
    }, { threshold: 0.5 });
    obs.observe(el);
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const rows = parseCSV(KIRO_CSV);

  initTabs();
  initCounters();
  buildKiroTable(rows);

  // Overview charts
  chartSdlcAdoption();
  chartMonthlyTrend();

  // Kiro charts
  chartKiroTopUsers(rows);
  chartKiroClientType(rows);
  chartKiroModels(rows);
  chartKiroDailyTrend();

  // Business Requirements charts
  chartBizQuality();
  chartBizTools();

  // Solution Design charts
  chartSolutionRadar();
  chartSolutionArtifacts();

  // QA charts
  chartQATestCases();
  chartQATypes();
  chartQADefects();

  // Production Deployment charts
  chartProdFrequency();
  chartProdAIvsManual();
  chartProdSuccessRate();
});
