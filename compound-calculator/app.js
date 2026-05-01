let chartInstance = null;
let scenarioData = [];
let currentScenario = 1; // 0=비관 1=기준 2=낙관

function isLight() {
  return document.documentElement.getAttribute('data-theme') === 'light';
}

function chartColors() {
  const light = isLight();
  return {
    tick:         light ? '#9898b0' : '#44445a',
    tickAlt:      light ? '#55556a' : '#8888a0',
    grid:         light ? 'rgba(0,0,0,0.06)'         : 'rgba(255,255,255,0.04)',
    tooltipBg:    light ? '#ffffff'                  : '#111118',
    tooltipBorder:light ? 'rgba(0,0,0,0.09)'         : 'rgba(255,255,255,0.07)',
    tooltipTitle: light ? '#0e0e1a'                  : '#f0f0f5',
    tooltipBody:  light ? '#55556a'                  : '#8888a0',
  };
}

// 콤마 포함 문자열 → 숫자
function parseNum(id) {
  return parseFloat(document.getElementById(id).value.replace(/,/g, '')) || 0;
}

function getInputs() {
  return {
    initial:   parseNum('initialAmount'),
    monthly:   parseNum('monthlyContrib'),
    years:     Math.max(1, parseInt(document.getElementById('years').value) || 20),
    rate:      parseFloat(document.getElementById('annualReturn').value)    || 0,
    taxRate:   parseFloat(document.getElementById('taxRate').value)         || 0,
    inflation: parseFloat(document.getElementById('inflationRate').value)   || 0,
    target:    parseNum('targetAmount'),
  };
}

// 원화 입력 필드 실시간 콤마 포맷
function setupCommaInputs() {
  ['initialAmount', 'monthlyContrib', 'targetAmount'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function () {
      var pos    = this.selectionStart;
      var oldLen = this.value.length;
      var raw    = this.value.replace(/[^0-9]/g, '');

      // 정규식으로 3자리마다 콤마 삽입 (toLocaleString 환경 의존성 제거)
      this.value = raw ? raw.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '';

      // 콤마 추가/제거에 따른 커서 위치 보정
      var newPos = Math.max(0, pos + this.value.length - oldLen);
      this.setSelectionRange(newPos, newPos);

      // 포매터에서 직접 호출 (이벤트 순서 의존 제거)
      calculate();
    });
  });
}

// 단일 시나리오 연말 데이터 배열 반환
function calcScenario(initial, monthly, years, annualRate, taxRate, inflation) {
  const r = annualRate / 100 / 12;
  const rows = [];
  let balance = initial;

  for (let y = 1; y <= years; y++) {
    const startBalance = balance;

    for (let m = 0; m < 12; m++) {
      balance = balance * (1 + r) + monthly;
    }

    const totalInvested = initial + monthly * 12 * y;
    const gains         = balance - totalInvested;
    const tax           = Math.max(0, gains) * (taxRate / 100);
    const afterTax      = balance - tax;
    const realValue     = afterTax / Math.pow(1 + inflation / 100, y);
    const yearGain      = balance - startBalance - monthly * 12;
    const cumReturn     = totalInvested > 0 ? (gains / totalInvested) * 100 : 0;

    rows.push({ year: y, yearlyContrib: monthly * 12, yearGain, endBalance: balance,
                afterTax, realValue, cumReturn, totalInvested });
  }
  return rows;
}

// 목표금액 달성을 위한 필요 월 납입금 계산
function calcMonthlyForTarget(target, initial, years, annualRate) {
  if (!target || target <= 0) return null;
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) {
    const required = (target - initial) / n;
    return required > 0 ? required : 0;
  }
  const factor = Math.pow(1 + r, n);
  const required = (target - initial * factor) * r / (factor - 1);
  return required > 0 ? required : 0;
}

// 금액 포맷 (억/만 단위 축약)
function fmt(val) {
  const abs = Math.abs(val);
  if (abs >= 1e8)  return (val / 1e8).toFixed(1) + '억';
  if (abs >= 1e4)  return Math.round(val / 1e4) + '만';
  return Math.round(val).toLocaleString();
}

function fmtFull(val) {
  return Math.round(val).toLocaleString();
}

// ── 렌더링 ────────────────────────────────────────

function renderSummary(inp, base) {
  const last          = base[base.length - 1];
  const totalInvested = inp.initial + inp.monthly * 12 * inp.years;
  const gains         = last.endBalance - totalInvested;

  const cards = [
    { label: '세전 최종 금액',  value: fmt(last.endBalance) + '원', sub: `수익 +${fmt(gains)}원` },
    { label: '세후 최종 금액',  value: fmt(last.afterTax) + '원',   sub: `세율 ${inp.taxRate}% 적용` },
    { label: '실질 가치',       value: fmt(last.realValue) + '원',   sub: `물가상승률 ${inp.inflation}% 반영` },
    { label: '누적 수익률',     value: (last.cumReturn >= 0 ? '+' : '') + last.cumReturn.toFixed(1) + '%',
                                sub: `총 납입 ${fmt(totalInvested)}원` },
  ];

  document.getElementById('summaryCards').innerHTML = cards.map((c, i) => `
    <div class="summary-card" style="animation-delay:${i * 0.07}s">
      <p class="s-label">${c.label}</p>
      <p class="s-value">${c.value}</p>
      <p class="s-sub">${c.sub}</p>
    </div>`).join('');
}

function renderChart(inp, scenarios) {
  const labels   = scenarios[1].map(r => r.year + '년');
  const invested = scenarios[1].map(r => r.totalInvested);
  const rates    = [inp.rate - 3, inp.rate, inp.rate + 3];

  const palette = [
    { line: '#f0606a', bg: 'rgba(240,96,106,0.06)' },
    { line: '#7c6ef2', bg: 'rgba(124,110,242,0.06)' },
    { line: '#3dd68c', bg: 'rgba(61,214,140,0.06)'  },
  ];

  const datasets = [
    {
      label: '납입 원금',
      data: invested,
      borderColor: '#44445a',
      backgroundColor: 'transparent',
      borderDash: [5, 5],
      borderWidth: 1.5,
      pointRadius: 0,
    },
    ...scenarios.map((s, i) => ({
      label: `${['비관','기준','낙관'][i]} (${rates[i]}%)`,
      data: s.map(r => r.afterTax),
      borderColor: palette[i].line,
      backgroundColor: palette[i].bg,
      borderWidth: i === 1 ? 2.5 : 1.8,
      pointRadius: 0,
      fill: false,
    })),
  ];

  document.getElementById('chartSub').textContent =
    `비관 ${rates[0]}% / 기준 ${rates[1]}% / 낙관 ${rates[2]}%`;

  if (chartInstance) chartInstance.destroy();

  const cc = chartColors();

  chartInstance = new Chart(document.getElementById('growthChart').getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: cc.tickAlt, font: { family: 'DM Mono', size: 11 } },
        },
        tooltip: {
          backgroundColor: cc.tooltipBg,
          borderColor: cc.tooltipBorder,
          borderWidth: 1,
          titleColor: cc.tooltipTitle,
          bodyColor: cc.tooltipBody,
          padding: 12,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${Math.round(ctx.raw).toLocaleString()}원`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: cc.tick, font: { family: 'DM Mono', size: 10 } },
          grid:  { color: cc.grid },
        },
        y: {
          ticks: {
            color: cc.tick,
            font: { family: 'DM Mono', size: 10 },
            callback: v => {
              if (v >= 1e8) return (v / 1e8).toFixed(0) + '억';
              if (v >= 1e4) return (v / 1e4).toFixed(0) + '만';
              return v;
            },
          },
          grid: { color: cc.grid },
        },
      },
    },
  });
}

function renderTable(rows) {
  document.getElementById('tableBody').innerHTML = rows.map(r => `
    <tr>
      <td>${r.year}</td>
      <td>${fmtFull(r.yearlyContrib)}</td>
      <td class="${r.yearGain >= 0 ? 'pos' : 'neg'}">${r.yearGain >= 0 ? '+' : ''}${fmtFull(r.yearGain)}</td>
      <td>${fmtFull(r.endBalance)}</td>
      <td>${fmtFull(r.afterTax)}</td>
      <td>${fmtFull(r.realValue)}</td>
      <td class="${r.cumReturn >= 0 ? 'pos' : 'neg'}">${r.cumReturn >= 0 ? '+' : ''}${r.cumReturn.toFixed(1)}%</td>
    </tr>`).join('');
}

function renderReverse(inp) {
  const el = document.getElementById('reverseResult');
  if (!inp.target) {
    el.classList.remove('visible');
    return;
  }
  const required = calcMonthlyForTarget(inp.target, inp.initial, inp.years, inp.rate);
  el.classList.add('visible');
  if (required === null || required <= 0) {
    el.innerHTML = `<span class="reverse-label">현재 조건으로 목표 달성 가능</span>`;
  } else {
    el.innerHTML = `
      <span class="reverse-label">목표 달성을 위한 월 납입금</span>
      <span class="reverse-value">${Math.round(required).toLocaleString()}원</span>`;
  }
}

// ── 메인 계산 ─────────────────────────────────────

function calculate() {
  const inp = getInputs();
  const rates = [inp.rate - 3, inp.rate, inp.rate + 3];

  scenarioData = rates.map(r => calcScenario(inp.initial, inp.monthly, inp.years, r, inp.taxRate, inp.inflation));

  renderSummary(inp, scenarioData[1]);
  renderChart(inp, scenarioData);
  renderTable(scenarioData[currentScenario]);
  renderReverse(inp);
}

// ── 이벤트 ────────────────────────────────────────

document.getElementById('scenarioTabs').addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentScenario = parseInt(btn.dataset.idx);
  if (scenarioData.length) renderTable(scenarioData[currentScenario]);
});

// 콤마 포매터를 먼저 등록 (포매터 내부에서 calculate() 직접 호출)
setupCommaInputs();

// 콤마 필드(initialAmount, monthlyContrib, targetAmount)는 위에서 처리했으므로 제외
['years', 'annualReturn', 'taxRate', 'inflationRate'].forEach(function (id) {
  document.getElementById(id).addEventListener('input', calculate);
});

document.addEventListener('themechange', calculate);

window.addEventListener('DOMContentLoaded', calculate);
