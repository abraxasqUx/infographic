/**
 * Google Apps Script — 투자 노트 저장 (최신순 정렬) + ETF 분석 프록시
 *
 * 사용법:
 *  1) https://script.google.com 에서 본인 프로젝트 열기
 *  2) Code.gs 내용을 이 파일로 교체
 *  3) "배포 → 배포 관리 → 활성 배포" 에서 새 버전으로 업데이트
 *  4) (선택) URL 변경 없이 같은 배포에 새 버전을 덮으면 dashboard/app.js GAS_URL 그대로
 *
 * Notes 시트 헤더 (1행):  date | ticker | title | content
 *   - 시트 1행이 위 순서가 되도록 사용자가 정렬해 주세요.
 *   - 새 노트는 항상 2행에 삽입되어 최신순으로 보입니다.
 */

const SPREADSHEET_ID = '1QUt1d1wneqkFloCrM0DAW24M90sRnPRfqaP5Ae_Qtnk';

function doGet(e) {
  const action = e.parameter.action || 'note';

  try {
    if (action === 'etf') {
      return handleETF(e);
    } else {
      return handleNote(e);
    }
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// ── 노트 저장 — 헤더 바로 아래(2행)에 삽입해서 최신순 유지 ───────
function handleNote(e) {
  const date    = e.parameter.date    || '';
  const ticker  = e.parameter.ticker  || '';
  const title   = e.parameter.title   || '';
  const content = e.parameter.content || '';

  if (!title) {
    return jsonResponse({ status: 'error', message: 'title required' });
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('Notes');
  if (!sheet) sheet = ss.insertSheet('Notes');

  // 헤더 자동 생성 (이미 있으면 건드리지 않음)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['date', 'ticker', 'title', 'content']);
  }

  // 2행 앞에 빈 행 삽입 → 새 노트는 항상 헤더 바로 아래에 위치
  sheet.insertRowsBefore(2, 1);
  sheet.getRange(2, 1, 1, 4).setValues([[date, ticker, title, content]]);

  return jsonResponse({ status: 'ok' });
}

// ── ETF 기록 저장 (대시보드에서는 더 이상 호출하지 않지만 보존) ──
function handleETF(e) {
  const ticker = (e.parameter.ticker || '').toUpperCase();
  const name   = e.parameter.name || ticker;

  if (!ticker) {
    return jsonResponse({ status: 'error', message: 'ticker required' });
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // ETF 조회 이력
  let etfSheet = ss.getSheetByName('ETF');
  if (!etfSheet) etfSheet = ss.insertSheet('ETF');
  if (etfSheet.getLastRow() === 0) {
    etfSheet.appendRow(['조회일시', 'ETF명', '티커']);
  }
  etfSheet.appendRow([new Date(), name, ticker]);

  // Yahoo Finance 구성종목 조회
  const holdings = fetchYahooHoldings(ticker);

  // ETF_Holdings 시트에 저장 (해당 티커 기존 행 삭제 후 재기록)
  let holdSheet = ss.getSheetByName('ETF_Holdings');
  if (!holdSheet) holdSheet = ss.insertSheet('ETF_Holdings');
  if (holdSheet.getLastRow() === 0) {
    holdSheet.appendRow(['etf_ticker', 'name', 'ticker', 'weight']);
  }

  const data = holdSheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]).toUpperCase() === ticker) holdSheet.deleteRow(i + 1);
  }

  holdings.forEach(h => {
    holdSheet.appendRow([ticker, h.name, h.ticker, h.weight]);
  });

  return jsonResponse({ status: 'ok', count: holdings.length });
}

// ── Yahoo Finance 구성종목 조회 ──────────────────────────────
function fetchYahooHoldings(ticker) {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=topHoldings`;

  const res = UrlFetchApp.fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    muteHttpExceptions: true,
  });

  if (res.getResponseCode() !== 200) return [];

  const json = JSON.parse(res.getContentText());
  const raw  = json?.quoteSummary?.result?.[0]?.topHoldings?.holdings;
  if (!raw || !raw.length) return [];

  return raw.map(h => ({
    name:   h.holdingName || h.symbol || '',
    ticker: h.symbol      || '',
    weight: +((h.holdingPercent || 0) * 100).toFixed(2),
  }));
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
