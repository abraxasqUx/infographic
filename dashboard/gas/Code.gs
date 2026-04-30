/**
 * Google Apps Script — 투자 노트 저장 + (선택) ETF 분석 프록시
 *
 * 사용법:
 *  1) https://script.google.com 에서 새 프로젝트 생성
 *  2) 이 파일 내용을 그대로 붙여넣기
 *  3) SPREADSHEET_ID 를 본인 시트 ID로 교체
 *  4) "배포 → 새 배포 → 웹 앱"  /  실행: 본인,  액세스: 모든 사용자
 *  5) 발급된 웹앱 URL 을 dashboard/app.js 의 GAS_URL 값으로 교체
 *
 * Notes 시트 헤더 (1행):  date | ticker | title | content
 *   - 시트의 1행이 위 순서가 되도록 정렬해 주세요.
 *   - ticker 가 비어 있어도 동작합니다 (전체 메모로 분류).
 */

const SPREADSHEET_ID = 'SPREADSHEET_ID_HERE';

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'note';

    if (action === 'note') {
      return saveNote(e.parameter);
    }
    if (action === 'etf') {
      return runEtf(e.parameter);
    }
    return jsonResponse({ status: 'error', message: 'unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ status: 'error', message: String(err) });
  }
}

/**
 * 노트 한 행 추가
 *   파라미터: date, ticker, title, content
 */
function saveNote(p) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Notes');
  if (!sheet) throw new Error('Notes 시트를 찾을 수 없습니다');

  sheet.appendRow([
    p.date    || '',
    p.ticker  || '',
    p.title   || '',
    p.content || '',
  ]);
  return jsonResponse({ status: 'ok' });
}

/**
 * (선택) 기존 ETF 분석을 그대로 쓰던 분이라면 본인 코드를 이 함수에 그대로 붙여넣어 두세요.
 * 대시보드에서는 더 이상 ETF 액션을 호출하지 않지만, 다른 클라이언트가 쓸 수 있어 호환을 위해 둠.
 */
function runEtf(p) {
  return jsonResponse({ status: 'error', message: 'etf endpoint is disabled' });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
