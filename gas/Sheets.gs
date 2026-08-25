/* Sheets.gs — ทางเข้าออกชีตทางเดียวของทั้งโปรเจกต์
   กฎ: ทางอ่านห้ามสร้างชีต (sheetIfExists_) ทางเขียนเท่านั้นที่สร้างได้ (sheetEnsure_) */

function sheetId_() {
  var id = prop_('SHEET_ID');
  if (!id) throw new Error('ยังไม่ได้ตั้งค่า SHEET_ID ใน Script Properties — รัน setupSheets() ก่อน');
  return id;
}

function book_() { return SpreadsheetApp.openById(sheetId_()); }

/** ทางอ่านอย่างเดียว ไม่มีชีต = null ห้ามสร้างชีตเปล่าทิ้งไว้ */
function sheetIfExists_(name) {
  return book_().getSheetByName(name) || null;
}

function sheetEnsure_(name, headers) {
  var bk = book_();
  var sh = bk.getSheetByName(name);
  if (!sh) {
    sh = bk.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    var texts = TEXT_COLS[name] || [];
    for (var i = 0; i < texts.length; i++) {
      var col = headers.indexOf(texts[i]) + 1;
      if (col > 0) sh.getRange(1, col, 2000, 1).setNumberFormat('@');
    }
  }
  return sh;
}

function readObjects_(name) {
  var sh = sheetIfExists_(name);
  if (!sh) return [];
  var vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];
  var head = vals[0], out = [];
  for (var r = 1; r < vals.length; r++) {
    var row = vals[r], blank = true;
    for (var c = 0; c < row.length; c++) {
      if (String(row[c] === null || row[c] === undefined ? '' : row[c]).trim() !== '') { blank = false; break; }
    }
    if (blank) continue;
    var o = {};
    for (var h = 0; h < head.length; h++) o[String(head[h])] = row[h];
    out.push(o);
  }
  return out;
}
