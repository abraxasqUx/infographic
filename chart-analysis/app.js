// ── Theme ──────────────────────────────────────────────────────────────────
function isLight() {
  return document.documentElement.getAttribute('data-theme') === 'light';
}

function C() {
  const light = isLight();
  return {
    bg:       light ? '#ffffff'                  : '#111118',
    text:     light ? '#9898b0'                  : '#44445a',
    textSec:  light ? '#55556a'                  : '#8888a0',
    grid:     light ? 'rgba(0,0,0,0.07)'         : 'rgba(255,255,255,0.06)',
    bull:     light ? '#15803d'                  : '#3dd68c',
    bear:     light ? '#dc2626'                  : '#f0606a',
    bb:       'rgba(124,110,242,0.55)',
    bbFill:   'rgba(124,110,242,0.07)',
    bbMid:    'rgba(124,110,242,0.85)',
    rsi:      '#7c6ef2',
    volMA:    'rgba(245,197,66,0.85)',
    cross:    light ? 'rgba(0,0,0,0.28)'         : 'rgba(255,255,255,0.22)',
    panelSep: light ? 'rgba(0,0,0,0.08)'         : 'rgba(255,255,255,0.05)',
  };
}

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  rawData: [],
  ticker:  'DEMO',
  period:  '6M',
  source:  'dummy',
};

// ── Dummy Data (Geometric Brownian Motion) ─────────────────────────────────
function generateDummyData() {
  const data  = [];
  let close   = 150;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rng   = d3.randomNormal(0, 1);
  const mu    = 0.0003;
  const sigma = 0.016;

  for (let i = 369; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const z         = rng();
    const prevClose = close;
    close = prevClose * Math.exp((mu - 0.5 * sigma * sigma) + sigma * z);

    const range  = close * sigma * (0.5 + Math.random() * 1.4);
    const open   = prevClose * (1 + (Math.random() - 0.5) * 0.014);
    const high   = Math.max(open, close) + Math.random() * range * 0.45;
    const low    = Math.min(open, close) - Math.random() * range * 0.45;
    const volume = Math.round(5e6 * (0.35 + Math.random() * 1.5 + Math.abs(z) * 0.5));

    data.push({ date, open, high, low: Math.max(0.01, low), close, volume });
  }
  return data;
}

// ── Period Filter ──────────────────────────────────────────────────────────
function filterByPeriod(data, period) {
  const days   = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days[period] || 180));
  const filtered = data.filter(d => d.date >= cutoff);
  return filtered.length ? filtered : data.slice(-22);
}

// ── Indicators ────────────────────────────────────────────────────────────
function calcSMA(values, period) {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    let sum = 0;
    for (let k = i - period + 1; k <= i; k++) sum += values[k];
    return sum / period;
  });
}

function calcBollinger(data, period = 20, mult = 2) {
  const closes = data.map(d => d.close);
  const sma    = calcSMA(closes, period);
  return data.map((d, i) => {
    if (sma[i] === null) return { date: d.date, mid: null, upper: null, lower: null };
    const slice = closes.slice(i - period + 1, i + 1);
    const mean  = sma[i];
    const std   = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
    return { date: d.date, mid: mean, upper: mean + mult * std, lower: mean - mult * std };
  });
}

function calcRSI(data, period = 14) {
  const closes = data.map(d => d.close);
  const result = data.map(d => ({ date: d.date, rsi: null }));
  if (closes.length < period + 1) return result;

  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  result[period].rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(0,  diff)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -diff)) / period;
    result[i].rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function fmtVol(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
  return String(Math.round(v));
}

function fmtVolShort(v) {
  if (v >= 1e6) return (v / 1e6).toFixed(0) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
  return String(Math.round(v));
}

// ── Chart Renderer ────────────────────────────────────────────────────────
function renderChart(data) {
  const container = document.getElementById('chartContainer');
  if (!container || !data.length) return;
  container.innerHTML = '';

  const clr = C();
  const W   = container.clientWidth || 900;
  const H   = Math.max(460, Math.min(620, W * 0.62));

  const M  = { top: 20, right: 68, bottom: 32, left: 10 };
  const iW = W - M.left - M.right;
  const iH = H - M.top - M.bottom;
  const GAP = 9;

  const priceH  = Math.floor(iH * 0.55);
  const volumeH = Math.floor(iH * 0.20);
  const rsiH    = iH - priceH - volumeH - GAP * 2;
  const priceY  = 0;
  const volumeY = priceH + GAP;
  const rsiY    = volumeY + volumeH + GAP;
  const xAxisY  = rsiY + rsiH;

  // Indicators
  const bb    = calcBollinger(data);
  const rsi   = calcRSI(data);
  const volMA = calcSMA(data.map(d => d.volume), 20);

  // Scales
  const xScale = d3.scaleBand()
    .domain(d3.range(data.length))
    .range([0, iW])
    .padding(data.length > 120 ? 0.1 : 0.15);

  const bw = xScale.bandwidth();

  const validBB  = bb.filter(b => b.upper !== null);
  const priceMin = validBB.length
    ? Math.min(d3.min(data, d => d.low),  d3.min(validBB, b => b.lower))
    : d3.min(data, d => d.low);
  const priceMax = validBB.length
    ? Math.max(d3.max(data, d => d.high), d3.max(validBB, b => b.upper))
    : d3.max(data, d => d.high);
  const pRange = priceMax - priceMin;

  const yPrice  = d3.scaleLinear()
    .domain([priceMin - pRange * 0.03, priceMax + pRange * 0.03])
    .range([priceH, 0]);

  const yVolume = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.volume) * 1.18])
    .range([volumeH, 0]);

  const yRSI = d3.scaleLinear()
    .domain([0, 100])
    .range([rsiH, 0]);

  // SVG root
  const svg = d3.select(container)
    .append('svg')
    .attr('id', 'mainChart')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('width', W)
    .attr('height', H);

  svg.append('rect')
    .attr('width', W).attr('height', H)
    .attr('fill', clr.bg);

  const inner = svg.append('g')
    .attr('transform', `translate(${M.left},${M.top})`);

  // Clip paths
  const defs = svg.append('defs');
  [{ id: 'clip-price', h: priceH }, { id: 'clip-volume', h: volumeH }, { id: 'clip-rsi', h: rsiH }]
    .forEach(({ id, h }) => {
      defs.append('clipPath').attr('id', id)
        .append('rect').attr('x', 0).attr('y', 0).attr('width', iW).attr('height', h);
    });

  // ── PRICE PANEL ──────────────────────────────
  const gPrice = inner.append('g')
    .attr('transform', `translate(0,${priceY})`)
    .attr('clip-path', 'url(#clip-price)');

  yPrice.ticks(5).forEach(v => {
    gPrice.append('line')
      .attr('x1', 0).attr('x2', iW)
      .attr('y1', yPrice(v)).attr('y2', yPrice(v))
      .attr('stroke', clr.grid).attr('stroke-width', 1);
  });

  // Bollinger bands
  const bbIdx = bb.map((b, i) => ({ ...b, i })).filter(b => b.mid !== null);
  if (bbIdx.length > 1) {
    gPrice.append('path')
      .datum(bbIdx)
      .attr('d', d3.area()
        .x(b => xScale(b.i) + bw / 2)
        .y0(b => yPrice(b.upper))
        .y1(b => yPrice(b.lower))
        .curve(d3.curveMonotoneX))
      .attr('fill', clr.bbFill).attr('stroke', 'none');

    [b => b.upper, b => b.lower].forEach(acc => {
      gPrice.append('path').datum(bbIdx)
        .attr('d', d3.line()
          .x(b => xScale(b.i) + bw / 2)
          .y(b => yPrice(acc(b)))
          .curve(d3.curveMonotoneX))
        .attr('fill', 'none').attr('stroke', clr.bb).attr('stroke-width', 1);
    });

    gPrice.append('path').datum(bbIdx)
      .attr('d', d3.line()
        .x(b => xScale(b.i) + bw / 2)
        .y(b => yPrice(b.mid))
        .curve(d3.curveMonotoneX))
      .attr('fill', 'none').attr('stroke', clr.bbMid)
      .attr('stroke-width', 1.3).attr('stroke-dasharray', '5,3');
  }

  // Wicks
  gPrice.selectAll('.wick').data(data).join('line')
    .attr('class', 'wick')
    .attr('x1', (_, i) => xScale(i) + bw / 2)
    .attr('x2', (_, i) => xScale(i) + bw / 2)
    .attr('y1', d => yPrice(d.high))
    .attr('y2', d => yPrice(d.low))
    .attr('stroke', d => d.close >= d.open ? clr.bull : clr.bear)
    .attr('stroke-width', Math.max(1, bw * 0.15));

  // Bodies
  gPrice.selectAll('.candle').data(data).join('rect')
    .attr('class', 'candle')
    .attr('x', (_, i) => xScale(i))
    .attr('width', bw)
    .attr('y', d => yPrice(Math.max(d.open, d.close)))
    .attr('height', d => Math.max(1, Math.abs(yPrice(d.open) - yPrice(d.close))))
    .attr('fill', d => d.close >= d.open ? clr.bull : clr.bear);

  inner.append('text')
    .attr('x', iW - 4).attr('y', priceY + 13).attr('text-anchor', 'end')
    .text('BB(20,2)  CANDLE')
    .attr('fill', clr.text).attr('font-family', 'DM Mono, monospace')
    .attr('font-size', '9px').attr('letter-spacing', '0.07em');

  inner.append('g')
    .attr('transform', `translate(${iW},${priceY})`)
    .call(d3.axisRight(yPrice).ticks(5).tickSize(4).tickFormat(d3.format(',.2f')))
    .call(g => {
      g.select('.domain').attr('stroke', clr.grid);
      g.selectAll('.tick line').attr('stroke', clr.grid);
      g.selectAll('.tick text').attr('fill', clr.textSec)
        .attr('font-family', 'DM Mono, monospace').attr('font-size', '10px');
    });

  // Panel separator
  inner.append('line')
    .attr('x1', 0).attr('x2', iW)
    .attr('y1', volumeY - 4).attr('y2', volumeY - 4)
    .attr('stroke', clr.panelSep).attr('stroke-width', 1);

  // ── VOLUME PANEL ─────────────────────────────
  const gVol = inner.append('g')
    .attr('transform', `translate(0,${volumeY})`)
    .attr('clip-path', 'url(#clip-volume)');

  gVol.selectAll('.vol-bar').data(data).join('rect')
    .attr('class', 'vol-bar')
    .attr('x', (_, i) => xScale(i))
    .attr('width', bw)
    .attr('y', d => yVolume(d.volume))
    .attr('height', d => volumeH - yVolume(d.volume))
    .attr('fill', d => d.close >= d.open ? clr.bull : clr.bear)
    .attr('opacity', 0.65);

  const volMAData = data.map((d, i) => ({ v: volMA[i], i })).filter(d => d.v !== null);
  if (volMAData.length > 1) {
    gVol.append('path').datum(volMAData)
      .attr('d', d3.line()
        .x(d => xScale(d.i) + bw / 2)
        .y(d => yVolume(d.v))
        .curve(d3.curveMonotoneX))
      .attr('fill', 'none').attr('stroke', clr.volMA).attr('stroke-width', 1.5);
  }

  inner.append('text')
    .attr('x', iW - 4).attr('y', volumeY + 11).attr('text-anchor', 'end')
    .text('VOL  MA(20)')
    .attr('fill', clr.text).attr('font-family', 'DM Mono, monospace')
    .attr('font-size', '9px').attr('letter-spacing', '0.07em');

  inner.append('g')
    .attr('transform', `translate(${iW},${volumeY})`)
    .call(d3.axisRight(yVolume).ticks(3).tickSize(4).tickFormat(fmtVolShort))
    .call(g => {
      g.select('.domain').remove();
      g.selectAll('.tick line').attr('stroke', clr.grid);
      g.selectAll('.tick text').attr('fill', clr.textSec)
        .attr('font-family', 'DM Mono, monospace').attr('font-size', '9px');
    });

  // Panel separator
  inner.append('line')
    .attr('x1', 0).attr('x2', iW)
    .attr('y1', rsiY - 4).attr('y2', rsiY - 4)
    .attr('stroke', clr.panelSep).attr('stroke-width', 1);

  // ── RSI PANEL ────────────────────────────────
  const gRSI = inner.append('g')
    .attr('transform', `translate(0,${rsiY})`)
    .attr('clip-path', 'url(#clip-rsi)');

  gRSI.append('rect')
    .attr('x', 0).attr('y', yRSI(100))
    .attr('width', iW).attr('height', yRSI(70) - yRSI(100))
    .attr('fill', 'rgba(240,96,106,0.07)');

  gRSI.append('rect')
    .attr('x', 0).attr('y', yRSI(30))
    .attr('width', iW).attr('height', yRSI(0) - yRSI(30))
    .attr('fill', 'rgba(61,214,140,0.07)');

  [{ v: 70, clr: 'rgba(240,96,106,0.45)' }, { v: 50, clr: null }, { v: 30, clr: 'rgba(61,214,140,0.45)' }]
    .forEach(({ v, clr: lc }) => {
      gRSI.append('line')
        .attr('x1', 0).attr('x2', iW)
        .attr('y1', yRSI(v)).attr('y2', yRSI(v))
        .attr('stroke', lc || clr.grid).attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3');
    });

  const rsiValid = rsi.map((r, i) => ({ rsi: r.rsi, i })).filter(r => r.rsi !== null);
  if (rsiValid.length > 1) {
    gRSI.append('path').datum(rsiValid)
      .attr('d', d3.line()
        .x(d => xScale(d.i) + bw / 2)
        .y(d => yRSI(d.rsi))
        .curve(d3.curveMonotoneX))
      .attr('fill', 'none').attr('stroke', clr.rsi).attr('stroke-width', 1.6);
  }

  inner.append('text')
    .attr('x', iW - 4).attr('y', rsiY + 11).attr('text-anchor', 'end')
    .text('RSI(14)')
    .attr('fill', clr.text).attr('font-family', 'DM Mono, monospace')
    .attr('font-size', '9px').attr('letter-spacing', '0.07em');

  inner.append('g')
    .attr('transform', `translate(${iW},${rsiY})`)
    .call(d3.axisRight(yRSI).tickValues([30, 50, 70]).tickSize(4))
    .call(g => {
      g.select('.domain').remove();
      g.selectAll('.tick line').attr('stroke', clr.grid);
      g.selectAll('.tick text').attr('fill', clr.textSec)
        .attr('font-family', 'DM Mono, monospace').attr('font-size', '9px');
    });

  // ── X-AXIS ───────────────────────────────────
  const tickStep = Math.ceil(data.length / (W < 560 ? 5 : 8));
  inner.append('g')
    .attr('transform', `translate(0,${xAxisY})`)
    .call(d3.axisBottom(xScale)
      .tickValues(d3.range(0, data.length, tickStep))
      .tickSize(4)
      .tickFormat(i => d3.timeFormat('%m/%d')(data[i].date)))
    .call(g => {
      g.select('.domain').attr('stroke', clr.grid);
      g.selectAll('.tick line').attr('stroke', clr.grid);
      g.selectAll('.tick text').attr('fill', clr.text)
        .attr('font-family', 'DM Mono, monospace').attr('font-size', '9px');
    });

  // ── CROSSHAIR ────────────────────────────────
  setupCrosshair(inner, data, { iW, xAxisY, xScale, bw, yPrice, rsi, clr });
}

// ── Crosshair ─────────────────────────────────────────────────────────────
function setupCrosshair(inner, data, { iW, xAxisY, xScale, bw, yPrice, rsi, clr }) {
  const gCross = inner.append('g')
    .style('pointer-events', 'none')
    .style('display', 'none');

  const vLine = gCross.append('line')
    .attr('y1', 0).attr('y2', xAxisY)
    .attr('stroke', clr.cross).attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,4');

  const hLine = gCross.append('line')
    .attr('x1', 0).attr('x2', iW)
    .attr('stroke', clr.cross).attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,4');

  const tooltip = document.getElementById('ohlcvTooltip');

  inner.append('rect')
    .attr('x', 0).attr('y', 0)
    .attr('width', iW).attr('height', xAxisY)
    .attr('fill', 'transparent')
    .style('cursor', 'crosshair')
    .on('mousemove', function(event) {
      const [mx] = d3.pointer(event);
      const idx  = Math.max(0, Math.min(data.length - 1, Math.floor(mx / xScale.step())));
      const d    = data[idx];
      if (!d) return;

      const cx = xScale(idx) + bw / 2;
      gCross.style('display', null);
      vLine.attr('x1', cx).attr('x2', cx);
      hLine.attr('y1', yPrice(d.close)).attr('y2', yPrice(d.close));

      if (tooltip) {
        const rsiVal   = rsi[idx] ? rsi[idx].rsi : null;
        const dir      = d.close >= d.open ? 'green' : 'red';
        const rsiColor = rsiVal === null ? '' : rsiVal > 70 ? 'color:#f0606a' : rsiVal < 30 ? 'color:#3dd68c' : '';

        tooltip.style.display = '';
        tooltip.innerHTML = `
          <div class="tip-date">${d3.timeFormat('%Y-%m-%d')(d.date)}</div>
          <div class="tip-row"><span class="tip-label">O</span><span class="tip-val tip-${dir}">${d.open.toFixed(2)}</span></div>
          <div class="tip-row"><span class="tip-label">H</span><span class="tip-val">${d.high.toFixed(2)}</span></div>
          <div class="tip-row"><span class="tip-label">L</span><span class="tip-val">${d.low.toFixed(2)}</span></div>
          <div class="tip-row"><span class="tip-label">C</span><span class="tip-val tip-${dir}">${d.close.toFixed(2)}</span></div>
          <div class="tip-row"><span class="tip-label">VOL</span><span class="tip-val">${fmtVol(d.volume)}</span></div>
          ${rsiVal !== null ? `<div class="tip-row"><span class="tip-label">RSI</span><span class="tip-val" style="${rsiColor}">${rsiVal.toFixed(1)}</span></div>` : ''}
        `;
      }
    })
    .on('mouseleave', () => {
      gCross.style('display', 'none');
      if (tooltip) tooltip.style.display = 'none';
    });
}

// ── Render (with period filter) ────────────────────────────────────────────
function render() {
  const data = filterByPeriod(state.rawData, state.period);
  renderChart(data);
}

// ── PNG Download ──────────────────────────────────────────────────────────
function downloadChart() {
  const svgEl = document.getElementById('mainChart');
  if (!svgEl) { showToast('차트가 없습니다', 'error'); return; }

  const clone   = svgEl.cloneNode(true);
  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleEl.textContent = `* { font-family: 'DM Mono', 'Courier New', monospace; }`;
  clone.insertBefore(styleEl, clone.firstChild);

  const svgStr = new XMLSerializer().serializeToString(clone);
  const blob   = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url    = URL.createObjectURL(blob);

  const img = new Image();
  img.onload = () => {
    const ratio  = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    canvas.width  = svgEl.width.baseVal.value * ratio;
    canvas.height = svgEl.height.baseVal.value * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    canvas.toBlob(pngBlob => {
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(pngBlob);
      a.download = `${state.ticker}-${state.period}-${d3.timeFormat('%Y%m%d')(new Date())}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  };
  img.onerror = () => { URL.revokeObjectURL(url); showToast('PNG 변환 실패', 'error'); };
  img.src = url;
}

// ── Toast ─────────────────────────────────────────────────────────────────
function showToast(msg, type = 'default') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className   = `toast show ${type}`;
  clearTimeout(el._tid);
  el._tid = setTimeout(() => { el.className = 'toast'; }, 3500);
}

// ── Google Sheets Integration ─────────────────────────────────────────────
async function loadFromSheets(ticker) {
  const rows = await fetchSheet(ticker);
  if (!rows.length) throw new Error('시트가 비어 있습니다');

  const firstKeys = Object.keys(rows[0]).map(k => k.toLowerCase().trim());
  const required  = ['date', 'open', 'high', 'low', 'close', 'volume'];
  const missing   = required.filter(r => !firstKeys.includes(r));
  if (missing.length) throw new Error(`컬럼 누락: ${missing.join(', ')}`);

  const get = (r, k) => r[k] !== undefined ? r[k] : r[k[0].toUpperCase() + k.slice(1)];

  const data = rows
    .map(r => ({
      date:   new Date(get(r, 'date')),
      open:   parseFloat(get(r, 'open')),
      high:   parseFloat(get(r, 'high')),
      low:    parseFloat(get(r, 'low')),
      close:  parseFloat(get(r, 'close')),
      volume: parseFloat(get(r, 'volume')),
    }))
    .filter(d => !isNaN(d.date.getTime()) && !isNaN(d.close) && d.close > 0)
    .sort((a, b) => a.date - b.date);

  if (!data.length) throw new Error('유효한 데이터 행이 없습니다');
  return data;
}

// ── Controls ──────────────────────────────────────────────────────────────
function setupControls() {
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.period = btn.dataset.period;
      render();
    });
  });

  const tickerInput = document.getElementById('tickerInput');
  const loadBtn     = document.getElementById('loadBtn');

  async function loadTicker() {
    const val = (tickerInput.value || '').trim().toUpperCase();
    if (!val) { showToast('티커를 입력해주세요', 'error'); return; }

    loadBtn.disabled    = true;
    loadBtn.textContent = '로딩 중...';

    try {
      const data = await loadFromSheets(val);
      state.rawData = data;
      state.ticker  = val;
      state.source  = 'sheets';
      document.getElementById('tickerLabel').textContent = val;
      const badge = document.getElementById('dataBadge');
      badge.textContent = 'LIVE';
      badge.classList.add('live');
      render();
      showToast(`${val} 데이터 ${data.length}개 로드 완료`, 'success');
    } catch (err) {
      showToast(`로드 실패: ${err.message}`, 'error');
    } finally {
      loadBtn.disabled    = false;
      loadBtn.textContent = '조회';
    }
  }

  loadBtn.addEventListener('click', loadTicker);
  tickerInput.addEventListener('keydown', e => { if (e.key === 'Enter') loadTicker(); });
  document.getElementById('downloadBtn').addEventListener('click', downloadChart);
  document.getElementById('infoBoxToggle').addEventListener('click', () => {
    document.getElementById('infoBox').classList.toggle('collapsed');
  });
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Init ──────────────────────────────────────────────────────────────────
function init() {
  state.rawData = generateDummyData();
  setupControls();
  render();
  window.addEventListener('resize', debounce(render, 150));
  document.addEventListener('themechange', render);
}

document.addEventListener('DOMContentLoaded', init);
