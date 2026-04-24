const GAS_URL = 'https://script.google.com/macros/s/AKfycbw_cq_NsyTMWHUJRAmAT3e3dqhTBpkSUxTvsiNWmYbfxWgvRqvOiwP2DvomgOf8EfOn6Q/exec';

let etfBarChart = null;

function showToast(msg, type = 'default') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  setTimeout(() => { el.className = 'toast'; }, 3000);
}

function setupETFPage() {
  const submitBtn  = document.getElementById('etfSubmitBtn');
  const tickerInput = document.getElementById('etfTickerInput');
  submitBtn.addEventListener('click', () => runETFAnalysis());
  tickerInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') runETFAnalysis();
  });
}

async function runETFAnalysis() {
  const name   = document.getElementById('etfNameInput').value.trim();
  const ticker = document.getElementById('etfTickerInput').value.trim().toUpperCase();

  if (!ticker) { showToast('티커를 입력해주세요', 'error'); return; }

  const submitBtn = document.getElementById('etfSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = '분석 중...';

  document.getElementById('etfResults').style.display = 'none';
  document.getElementById('etfLoading').style.display  = 'flex';

  try {
    const holdings = await fetchETFHoldings(name || ticker, ticker);
    renderETFResults(name || ticker, ticker, holdings);
  } catch (err) {
    console.error(err);
    showToast('데이터 로드 실패: ' + err.message, 'error');
  } finally {
    document.getElementById('etfLoading').style.display = 'none';
    submitBtn.disabled    = false;
    submitBtn.textContent = '분석하기';
  }
}

async function fetchETFHoldings(name, ticker) {
  const params = new URLSearchParams({ action: 'etf', name, ticker });
  const res = await fetch(`${GAS_URL}?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();
  if (json.status === 'error') throw new Error(json.message);
  if (!json.holdings || !json.holdings.length)
    throw new Error('구성종목 데이터를 찾을 수 없습니다. 티커를 확인해주세요.');

  return json.holdings;
}

function renderETFResults(name, ticker, holdings) {
  const sorted = [...holdings].sort((a, b) => b.weight - a.weight).slice(0, 20);
  const maxWeight = sorted[0]?.weight || 1;

  document.getElementById('etfInfoName').textContent   = name;
  document.getElementById('etfInfoTicker').textContent = ticker;
  document.getElementById('etfInfoCount').textContent  = `구성종목 ${holdings.length}개`;

  if (etfBarChart) etfBarChart.destroy();
  const ctx = document.getElementById('etfBarChart').getContext('2d');

  const chartLabels = sorted.map(h => h.name.length > 25 ? h.name.slice(0, 24) + '…' : h.name);

  etfBarChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartLabels,
      datasets: [{
        data: sorted.map(h => h.weight),
        backgroundColor: sorted.map((_, i) => `rgba(124,110,242,${1 - i * 0.035})`),
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.raw.toFixed(2)}%` },
          backgroundColor: '#16161f',
          borderColor: 'rgba(255,255,255,0.07)',
          borderWidth: 1,
          titleColor: '#f0f0f5',
          bodyColor: '#8888a0',
          padding: 10,
        },
      },
      scales: {
        x: {
          ticks: {
            color: '#44445a',
            callback: v => v + '%',
            font: { family: 'DM Mono', size: 11 },
          },
          grid: { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          ticks: {
            color: '#8888a0',
            font: { family: 'Noto Sans KR', size: 12 },
          },
          grid: { display: false },
        },
      },
    },
  });

  document.getElementById('etfBarChart').parentElement.style.height = `${sorted.length * 36 + 40}px`;

  const tbody = document.getElementById('etfHoldingsBody');
  tbody.innerHTML = sorted.map((h, i) => {
    const barPct = Math.min((h.weight / maxWeight) * 100, 100).toFixed(1);
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${h.name}</td>
        <td>${h.ticker}</td>
        <td style="text-align:right; font-family:var(--font-mono)">${h.weight.toFixed(2)}%</td>
        <td>
          <div class="etf-weight-bar">
            <div class="etf-weight-bg">
              <div class="etf-weight-fill" style="width:${barPct}%"></div>
            </div>
          </div>
        </td>
      </tr>`;
  }).join('');

  document.getElementById('etfResults').style.display = '';
}

document.addEventListener('DOMContentLoaded', () => {
  setupETFPage();
});
