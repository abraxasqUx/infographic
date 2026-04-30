/**
 * sheets.js — Google Sheets 공개 시트 데이터 연동
 *
 * ⚙️  설정: 아래 SHEET_ID 에 본인의 스프레드시트 ID를 입력하세요.
 *    URL 예시: https://docs.google.com/spreadsheets/d/[여기가_ID]/edit
 */

const SHEET_ID = '1QUt1d1wneqkFloCrM0DAW24M90sRnPRfqaP5Ae_Qtnk'; // ← 여기에 시트 ID 

const SHEET_NAMES = {
  holdings: 'Holdings',
  notes: 'Notes',
  summary: 'Summary',
};

/**
 * Google Sheets gviz/tq 엔드포인트에서 JSON 데이터를 파싱해 옵니다.
 */
async function fetchSheet(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`시트 로드 실패: ${sheetName} (${res.status})`);

  const text = await res.text();
  // gviz 응답은 "google.visualization.Query.setResponse({...})" 형태 → JSON 파싱
  const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  return parseGvizTable(json.table);
}

/**
 * gviz table 객체를 [{header: value, ...}] 형태의 배열로 변환
 */
function parseGvizTable(table) {
  if (!table || !table.rows) return [];

  const headers = table.cols.map(col => col.label.trim());

  return table.rows
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        const cell = row.c[i];
        obj[h] = cell ? (cell.v !== null && cell.v !== undefined ? cell.v : '') : '';
      });
      return obj;
    })
    .filter(row => Object.values(row).some(v => v !== '')); // 빈 행 제거
}

/**
 * Holdings 시트 데이터 로드 및 정규화
 * 기대 컬럼: account, ticker, name, category, quantity, avg_price, current_price, currency
 * category 값: 국내주식 | 해외주식 | 예수금
 * 예수금 행: quantity=1, avg_price=금액, current_price=금액 으로 입력
 */
async function loadHoldings() {
  const rows = await fetchSheet(SHEET_NAMES.holdings);
  return rows.map(r => ({
    account:       String(r.account || '').trim() || '기타',
    ticker:        String(r.ticker || '').trim(),
    name:          String(r.name || '').trim(),
    category:      String(r.category || '').trim(),
    quantity:      parseFloat(r.quantity) || 0,
    avg_price:     parseFloat(r.avg_price) || 0,
    current_price: parseFloat(r.current_price) || 0,
    currency:      String(r.currency || 'KRW').trim().toUpperCase(),
  }));
}

/**
 * Notes 시트 데이터 로드
 * 기대 컬럼: date, ticker, title, content
 */
async function loadNotes() {
  const rows = await fetchSheet(SHEET_NAMES.notes);
  return rows
    .map(r => ({
      date:    String(r.date || '').trim(),
      ticker:  String(r.ticker || '').trim(),
      title:   String(r.title || '').trim(),
      content: String(r.content || '').trim(),
    }))
    .filter(r => r.title)
    .sort((a, b) => (b.date > a.date ? 1 : -1)); // 최신순
}

/**
 * Summary 시트 데이터 로드 (선택사항)
 * 기대 컬럼: total_invested, total_value
 * Holdings에서 자동 계산 가능하므로 없어도 무방
 */
async function loadSummary() {
  try {
    const rows = await fetchSheet(SHEET_NAMES.summary);
    if (!rows.length) return null;
    return {
      total_invested: parseFloat(rows[0].total_invested) || 0,
      total_value:    parseFloat(rows[0].total_value) || 0,
    };
  } catch {
    return null; // Summary 시트가 없어도 정상 동작
  }
}

/**
 * 전체 데이터 로드
 */
async function loadAllData() {
  const [holdings, notes, summary] = await Promise.all([
    loadHoldings(),
    loadNotes(),
    loadSummary(),
  ]);
  return { holdings, notes, summary };
}

/**
 * ETF_Holdings 시트에서 특정 ETF 구성종목 로드 (GAS 기록 후 폴백용)
 * 기대 컬럼: etf_ticker, name, ticker, weight
 */
async function loadETFHoldingsFromSheet(etfTicker) {
  try {
    const rows = await fetchSheet('ETF_Holdings');
    return rows
      .filter(r => String(r.etf_ticker || '').toUpperCase() === etfTicker.toUpperCase())
      .map(r => ({
        name:   String(r.name   || '').trim(),
        ticker: String(r.ticker || '').trim(),
        weight: parseFloat(r.weight) || 0,
      }))
      .filter(r => r.name);
  } catch {
    return [];
  }
}
