/**
 * app.js — 포트폴리오 대시보드 메인 로직
 */

// =============================================
// 더미 데이터 (시트 연동 전 테스트용)
// SHEET_ID 설정 후 자동으로 실제 데이터로 전환됩니다.
// =============================================
const DUMMY_DATA = {
  holdings: [
    { ticker: '005930', name: '삼성전자',     category: '국내주식', quantity: 50,  avg_price: 68000,  current_price: 74500,  currency: 'KRW' },
    { ticker: '000660', name: 'SK하이닉스',   category: '국내주식', quantity: 20,  avg_price: 142000, current_price: 178000, currency: 'KRW' },
    { ticker: '035420', name: 'NAVER',        category: '국내주식', quantity: 10,  avg_price: 210000, current_price: 195000, currency: 'KRW' },
    { ticker: 'AAPL',   name: 'Apple',        category: '해외주식', quantity: 15,  avg_price: 170,    current_price: 213,    currency: 'USD' },
    { ticker: 'NVDA',   name: 'NVIDIA',       category: '해외주식', quantity: 10,  avg_price: 480,    current_price: 875,    currency: 'USD' },
    { ticker: 'MSFT',   name: 'Microsoft',    category: '해외주식', quantity: 8,   avg_price: 360,    current_price: 415,    currency: 'USD' },
    { ticker: '069500', name: 'KODEX 200',    category: '국내주식', quantity: 100, avg_price: 32000,  current_price: 34800,  currency: 'KRW' },
    { ticker: 'SPY',    name: 'SPDR S&P 500', category: '해외주식', quantity: 5,   avg_price: 450,    current_price: 520,    currency: 'USD' },
    { ticker: '-',      name: '예수금',        category: '예수금',   quantity: 1,   avg_price: 3500000, current_price: 3500000, currency: 'KRW' },
  ],
  notes: [
    { date: '2025-04-10', title: 'NVIDIA 추가 매수 검토', content: 'AI 인프라 수요 지속으로 하반기 실적 기대.\n현 가격대에서 분할 매수 고려 중.' },
    { date: '2025-03-25', title: '1분기 포트폴리오 리밸런싱', content: '국내주식 비중이 높아짐.\n해외 ETF 비중 늘리는 방향으로 조정 예정.' },
    { date: '2025-03-01', title: 'NAVER 편입', content: 'AI 커머스, 광고 반등 기대.\n목표가 240,000원.' },
  ],
  summary: null,
};

// USD → KRW 환율 (임시 고정값, 필요 시 API 연동 가능)
const USD_TO_KRW = 1380;

// =============================================
// 상태
// =============================================
let state = {
  holdings: [],
  notes: [],
  pieChart: null,
  currentPieType: 'category',  // 'category' | 'ticker'
  currentCategoryFilter: '전체',
};

// =============================================
// 유틸리티
// =============================================
function toKRW(amount, currency) {
  return currency === 'USD' ? amount * USD_TO_KRW : amount;
}

function formatKRW(amount) {
  if (Math.abs(amount) >= 1_0000_0000) {
    return (amount / 1_0000_0000).toFixed(2) + '억';
  }
  if (Math.abs(amount) >= 10000) {
    return (amount / 10000).toFixed(0) + '만';
  }
  return amount.toLocaleString('ko-KR');
}

function formatKRWFull(amount) {
  return amount.toLocaleString('ko-KR') + '원';
}

function formatPct(pct) {
  const sign = pct >= 0 ? '+' : '';
  return sign + pct.toFixed(2) + '%';
}

function pctClass(pct) {
  if (pct > 0) return 'positive';
  if (pct < 0) return 'negative';
  return 'neutral';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function showToast(msg, type = 'default') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  setTimeout(() => { el.className = 'toast'; }, 3000);
}

// =============================================
// 계산
// =============================================
function calcHoldings(holdings) {
  return holdings.map(h => {
    // 예수금은 수익/손실 계산 제외
    if (h.category === '예수금') {
      const valueKRW = h.quantity * h.current_price;
      return { ...h, investedKRW: valueKRW, valueKRW, pnlKRW: 0, pnlPct: 0, isCash: true };
    }

    const investedRaw = h.quantity * h.avg_price;
    const valueRaw    = h.quantity * h.current_price;
    const pnlRaw      = valueRaw - investedRaw;

    const investedKRW = toKRW(investedRaw, h.currency);
    const valueKRW    = toKRW(valueRaw, h.currency);
    const pnlKRW      = toKRW(pnlRaw, h.currency);
    const pnlPct      = investedRaw > 0 ? (pnlRaw / investedRaw) * 100 : 0;

    return { ...h, investedKRW, valueKRW, pnlKRW, pnlPct, isCash: false };
  });
}

function calcPortfolio(computed) {
  const totalValue    = computed.reduce((s, h) => s + h.valueKRW, 0);
  // 예수금은 원금/손익 계산에서 제외
  const stocks        = computed.filter(h => !h.isCash);
  const totalInvested = stocks.reduce((s, h) => s + h.investedKRW, 0);
  const totalPnl      = stocks.reduce((s, h) => s + h.pnlKRW, 0);
  const totalPnlPct   = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  const cashTotal     = computed.filter(h => h.isCash).reduce((s, h) => s + h.valueKRW, 0);
  return { totalValue, totalInvested, totalPnl, totalPnlPct, cashTotal };
}

// =============================================
// Summary Cards
// =============================================
function renderSummary(computed) {
  const { totalValue, totalInvested, totalPnl, totalPnlPct } = calcPortfolio(computed);

  document.getElementById('totalValue').textContent    = formatKRW(totalValue) + '원';
  document.getElementById('totalValueUSD').textContent = '≈ $' + (totalValue / USD_TO_KRW).toLocaleString('en-US', { maximumFractionDigits: 0 });
  document.getElementById('totalInvested').textContent = formatKRW(totalInvested) + '원';

  const pnlEl    = document.getElementById('totalPnl');
  const pnlPctEl = document.getElementById('totalPnlPct');
  pnlEl.textContent    = (totalPnl >= 0 ? '+' : '') + formatKRW(totalPnl) + '원';
  pnlEl.className      = 'card-value ' + pctClass(totalPnl);
  pnlPctEl.textContent = formatPct(totalPnlPct);
  pnlPctEl.className   = 'card-sub ' + pctClass(totalPnlPct);

  document.getElementById('holdingCount').textContent = computed.length + '개';
}

// =============================================
// Pie Chart
// =============================================
const PIE_COLORS = {
  '국내주식': '#7c6ef2',
  '해외주식': '#4fa3e0',
  '예수금':   '#f5c542',
};

const TICKER_COLORS = [
  '#7c6ef2','#4fa3e0','#3dd68c','#f5875a','#f5c542',
  '#e06a8c','#5ac8d8','#b07cf5','#7abf5a','#e09a4a',
];

function renderPieChart(computed, type) {
  const totalValue = computed.reduce((s, h) => s + h.valueKRW, 0);

  let labels, values, colors;

  if (type === 'category') {
    const groups = {};
    computed.forEach(h => {
      groups[h.category] = (groups[h.category] || 0) + h.valueKRW;
    });
    labels = Object.keys(groups);
    values = labels.map(k => groups[k]);
    colors = labels.map(k => PIE_COLORS[k] || '#666');
  } else {
    labels = computed.map(h => h.ticker);
    values = computed.map(h => h.valueKRW);
    colors = computed.map((_, i) => TICKER_COLORS[i % TICKER_COLORS.length]);
  }

  if (state.pieChart) state.pieChart.destroy();

  const ctx = document.getElementById('pieChart').getContext('2d');
  state.pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: '#111118',
        borderWidth: 3,
        hoverOffset: 6,
      }],
    },
    options: {
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pct = ((ctx.raw / totalValue) * 100).toFixed(1);
              return ` ${formatKRW(ctx.raw)}원 (${pct}%)`;
            },
          },
          backgroundColor: '#16161f',
          borderColor: 'rgba(255,255,255,0.07)',
          borderWidth: 1,
          titleColor: '#f0f0f5',
          bodyColor: '#8888a0',
          padding: 10,
        },
      },
      animation: { animateRotate: true, duration: 700 },
    },
  });

  // Legend
  const legendEl = document.getElementById('pieLegend');
  legendEl.innerHTML = labels.map((label, i) => {
    const pct = ((values[i] / totalValue) * 100).toFixed(1);
    return `
      <div class="legend-item">
        <span class="legend-dot" style="background:${colors[i]}"></span>
        <span class="legend-name">${label}</span>
        <span class="legend-pct">${pct}%</span>
      </div>`;
  }).join('');
}

// =============================================
// Category Breakdown
// =============================================
function renderCategoryBreakdown(computed) {
  const totalValue = computed.reduce((s, h) => s + h.valueKRW, 0);

  const cats = ['국내주식', '해외주식', '예수금'];
  const groups = {};
  cats.forEach(c => { groups[c] = { value: 0, invested: 0 }; });
  computed.forEach(h => {
    if (groups[h.category]) {
      groups[h.category].value    += h.valueKRW;
      groups[h.category].invested += h.investedKRW;
    }
  });

  const el = document.getElementById('categoryList');
  el.innerHTML = cats.map(cat => {
    const g   = groups[cat];
    const pct = totalValue > 0 ? (g.value / totalValue) * 100 : 0;
    const pnl = g.value - g.invested;
    const pnlPct = g.invested > 0 ? ((pnl / g.invested) * 100) : 0;
    const color = PIE_COLORS[cat] || '#888';

    return `
      <div class="category-item">
        <div class="category-top">
          <span class="category-name">
            <span class="category-badge" style="background:${color}"></span>
            ${cat}
          </span>
          <span class="category-amount">${formatKRW(g.value)}원</span>
        </div>
        <div class="category-bar-bg">
          <div class="category-bar-fill" style="width:${pct}%; background:${color}"></div>
        </div>
        <div class="category-bottom">
          <span class="category-pct">${pct.toFixed(1)}%</span>
          ${cat === '예수금'
            ? '<span class="category-pnl neutral">수익률 해당없음</span>'
            : `<span class="category-pnl ${pctClass(pnl)}">${pnl >= 0 ? '+' : ''}${formatKRW(pnl)}원 (${formatPct(pnlPct)})</span>`
          }
        </div>
      </div>`;
  }).join('');
}

// =============================================
// Holdings Table
// =============================================
function renderHoldingsTable(computed, filter = '전체') {
  const totalValue = computed.reduce((s, h) => s + h.valueKRW, 0);
  const filtered   = filter === '전체' ? computed : computed.filter(h => h.category === filter);

  const tbody = document.getElementById('holdingsBody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted)">데이터 없음</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(h => {
    const weight = totalValue > 0 ? (h.valueKRW / totalValue) * 100 : 0;
    const priceUnit = h.currency === 'USD' ? '$' : '₩';

    if (h.isCash) {
      return `
        <tr>
          <td>
            <span class="ticker-name">${h.name}</span>
            <span class="ticker-code">KRW</span>
          </td>
          <td><span class="cat-tag cat-tag--예수금">${h.category}</span></td>
          <td class="neutral">—</td>
          <td class="neutral">—</td>
          <td class="neutral">—</td>
          <td>${formatKRW(h.valueKRW)}원</td>
          <td class="neutral">—</td>
          <td class="neutral">—</td>
          <td>
            <div class="weight-bar">
              <div class="weight-bar-inner">
                <div class="weight-bar-fill" style="width:${Math.min(weight * 2, 100)}%"></div>
              </div>
              ${weight.toFixed(1)}%
            </div>
          </td>
        </tr>`;
    }

    return `
      <tr>
        <td>
          <span class="ticker-name">${h.name}</span>
          <span class="ticker-code">${h.ticker}</span>
        </td>
        <td><span class="cat-tag cat-tag--${h.category}">${h.category}</span></td>
        <td>${h.quantity.toLocaleString()}</td>
        <td>${priceUnit}${h.avg_price.toLocaleString()}</td>
        <td>${priceUnit}${h.current_price.toLocaleString()}</td>
        <td>${formatKRW(h.valueKRW)}원</td>
        <td class="${pctClass(h.pnlKRW)}">${h.pnlKRW >= 0 ? '+' : ''}${formatKRW(h.pnlKRW)}원</td>
        <td class="${pctClass(h.pnlPct)}">${formatPct(h.pnlPct)}</td>
        <td>
          <div class="weight-bar">
            <div class="weight-bar-inner">
              <div class="weight-bar-fill" style="width:${Math.min(weight * 2, 100)}%"></div>
            </div>
            ${weight.toFixed(1)}%
          </div>
        </td>
      </tr>`;
  }).join('');
}

// =============================================
// Notes
// =============================================
function renderNotes(notes) {
  const el = document.getElementById('notesList');
  if (!notes.length) {
    el.innerHTML = `<div class="notes-empty">아직 작성한 노트가 없어요</div>`;
    return;
  }
  el.innerHTML = notes.map(n => `
    <div class="note-card">
      <div class="note-card-header">
        <span class="note-card-title">${n.title}</span>
        <span class="note-card-date">${n.date}</span>
      </div>
      <div class="note-card-content">${n.content}</div>
    </div>`).join('');
}

// =============================================
// Notes — Google Apps Script로 시트에 저장
// =============================================

// ⚙️ Apps Script 웹앱 URL
const GAS_URL = 'https://script.google.com/macros/s/AKfycbw_cq_NsyTMWHUJRAmAT3e3dqhTBpkSUxTvsiNWmYbfxWgvRqvOiwP2DvomgOf8EfOn6Q/exec';

async function saveNoteToSheet(note) {
  // GET 방식 사용 — no-cors 환경에서 가장 안정적
  const params = new URLSearchParams({
    date:    note.date,
    title:   note.title,
    content: note.content,
  });
  await fetch(`${GAS_URL}?${params.toString()}`, {
    method: 'GET',
    mode: 'no-cors',
  });
}

function setupNoteForm() {
  const addBtn    = document.getElementById('addNoteBtn');
  const form      = document.getElementById('noteForm');
  const cancelBtn = document.getElementById('cancelNote');
  const saveBtn   = document.getElementById('saveNote');

  addBtn.addEventListener('click', () => {
    form.style.display = 'block';
    document.getElementById('noteTitle').focus();
  });

  cancelBtn.addEventListener('click', () => {
    form.style.display = 'none';
    document.getElementById('noteTitle').value   = '';
    document.getElementById('noteContent').value = '';
  });

  saveBtn.addEventListener('click', async () => {
    const title   = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();

    if (!title) { showToast('제목을 입력해주세요', 'error'); return; }

    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';

    const newNote = { date: today(), title, content };

    try {
      await saveNoteToSheet(newNote);
      state.notes.unshift(newNote);
      renderNotes(state.notes);

      form.style.display = 'none';
      document.getElementById('noteTitle').value   = '';
      document.getElementById('noteContent').value = '';

      showToast('노트가 구글 시트에 저장됐어요 ✓', 'success');
    } catch (err) {
      console.error(err);
      showToast('저장 실패: ' + err.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '저장';
    }
  });
}

// =============================================
// Sync Status
// =============================================
function setSyncStatus(status, label) {
  const dot   = document.querySelector('.sync-dot');
  const text  = document.getElementById('syncLabel');
  dot.className  = `sync-dot ${status}`;
  text.textContent = label;
}

function setLastUpdated() {
  const now = new Date();
  document.getElementById('lastUpdated').textContent =
    now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

// =============================================
// Render All
// =============================================
function renderAll(data) {
  state.holdings = data.holdings;
  state.notes    = data.notes;

  const computed = calcHoldings(state.holdings);

  renderSummary(computed);
  renderPieChart(computed, state.currentPieType);
  renderCategoryBreakdown(computed);
  renderHoldingsTable(computed, state.currentCategoryFilter);
  renderNotes(state.notes);
}

// =============================================
// Data Loading
// =============================================
async function loadData() {
  const refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.classList.add('spinning');
  setSyncStatus('', '동기화 중...');

  try {
    let data;

    if (SHEET_ID === 'YOUR_SHEET_ID_HERE') {
      // 더미 데이터 모드
      await new Promise(r => setTimeout(r, 600)); // 로딩 시뮬레이션
      data = DUMMY_DATA;
      setSyncStatus('', '더미 데이터 모드');
      showToast('sheets.js에서 SHEET_ID를 설정하면 실제 데이터가 표시됩니다');
    } else {
      data = await loadAllData();
      setSyncStatus('live', '시트 연동됨');
      setLastUpdated();
    }

    renderAll(data);
  } catch (err) {
    console.error(err);
    setSyncStatus('error', '연동 오류');
    showToast('데이터 로드 실패: ' + err.message, 'error');
    // 오류 시 더미 데이터로 폴백
    renderAll(DUMMY_DATA);
  } finally {
    refreshBtn.classList.remove('spinning');
  }
}

// =============================================
// Event Listeners
// =============================================
function setupEventListeners() {
  // 새로고침
  document.getElementById('refreshBtn').addEventListener('click', loadData);

  // 파이 차트 토글
  document.getElementById('pieToggle').addEventListener('click', e => {
    const btn = e.target.closest('.toggle-btn');
    if (!btn) return;
    document.querySelectorAll('#pieToggle .toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.currentPieType = btn.dataset.type;
    renderPieChart(calcHoldings(state.holdings), state.currentPieType);
  });

  // 카테고리 필터
  document.getElementById('categoryFilter').addEventListener('click', e => {
    const btn = e.target.closest('.toggle-btn');
    if (!btn) return;
    document.querySelectorAll('#categoryFilter .toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.currentCategoryFilter = btn.dataset.cat;
    renderHoldingsTable(calcHoldings(state.holdings), state.currentCategoryFilter);
  });
}

// =============================================
// =============================================
// Init
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  setupLockScreen();
  setupEventListeners();
  setupNoteForm();
  loadData();
});

// =============================================
// Lock Screen
// =============================================
const CORRECT_PIN = '13579';

function setupLockScreen() {
  let entered = '';

  const lockScreen = document.getElementById('lockScreen');
  const pinDots    = document.getElementById('pinDots');
  const pinError   = document.getElementById('pinError');
  const dots       = pinDots.querySelectorAll('.pin-dot');

  function updateDots() {
    dots.forEach((dot, i) => {
      dot.classList.toggle('filled', i < entered.length);
      dot.classList.remove('error');
    });
    pinError.textContent = '';
  }

  function showError() {
    dots.forEach(dot => { dot.classList.add('error'); dot.classList.remove('filled'); });
    pinDots.classList.add('shake');
    pinError.textContent = '잘못된 PIN입니다';
    setTimeout(() => {
      pinDots.classList.remove('shake');
      dots.forEach(dot => dot.classList.remove('error'));
      pinError.textContent = '';
    }, 500);
    entered = '';
  }

  function unlock() {
    lockScreen.classList.add('hidden');
    setTimeout(() => { lockScreen.style.display = 'none'; }, 400);
  }

  function lock() {
    entered = '';
    updateDots();
    lockScreen.style.display = 'flex';
    requestAnimationFrame(() => lockScreen.classList.remove('hidden'));
  }

  function handleInput(n) {
    if (entered.length >= CORRECT_PIN.length) return;
    entered += n;
    updateDots();

    if (entered.length === CORRECT_PIN.length) {
      setTimeout(() => {
        if (entered === CORRECT_PIN) unlock();
        else showError();
      }, 120);
    }
  }

  // 숫자패드 클릭
  document.querySelectorAll('.num-btn[data-n]').forEach(btn => {
    btn.addEventListener('click', () => handleInput(btn.dataset.n));
  });

  // 삭제 버튼
  document.getElementById('delBtn').addEventListener('click', () => {
    entered = entered.slice(0, -1);
    updateDots();
  });

  // 키보드 입력
  document.addEventListener('keydown', e => {
    if (lockScreen.style.display === 'none') return;
    if (/^\d$/.test(e.key)) handleInput(e.key);
    if (e.key === 'Backspace') { entered = entered.slice(0, -1); updateDots(); }
  });

  // 대기화면 버튼
  document.getElementById('lockBtn').addEventListener('click', lock);
}
