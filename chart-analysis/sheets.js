const SHEET_ID = '1QUt1d1wneqkFloCrM0DAW24M90sRnPRfqaP5Ae_Qtnk';

async function fetchSheet(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`시트 로드 실패: ${sheetName} (${res.status})`);
  const text = await res.text();
  const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  return parseGvizTable(json.table);
}

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
    .filter(row => Object.values(row).some(v => v !== ''));
}
