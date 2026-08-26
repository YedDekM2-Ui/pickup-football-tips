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

/** หัวตารางในชีตจริงถูกเขียนตอน "สร้างชีต" ครั้งเดียว
    พอเพิ่มคอลัมน์ใหม่ในโค้ด ชีตเก่าจึงไม่มีหัวนั้น -> ค่าที่เขียนลงไปอ่านกลับไม่ได้เลย
    (readObjects_ ตั้งชื่อคีย์จากแถว 1) จึงต้องเติมหัวที่ขาด "ต่อท้าย" ให้เอง
    เติมอย่างเดียว ห้ามสลับ/ลบของเดิม */
function sheetHeadSync_(sh, name, headers) {
  var vals = sh.getDataRange().getValues();
  var head = (vals && vals.length) ? vals[0] : [];
  var have = {}, i;
  for (i = 0; i < head.length; i++) have[String(head[i]).trim()] = true;
  var add = [];
  for (i = 0; i < headers.length; i++) if (!have[headers[i]]) add.push(headers[i]);
  if (!add.length) return sh;
  var at = head.length;
  sh.getRange(1, at + 1, 1, add.length).setValues([add]);
  var texts = TEXT_COLS[name] || [];
  for (i = 0; i < add.length; i++) {
    if (texts.indexOf(add[i]) >= 0) sh.getRange(1, at + 1 + i, 2000, 1).setNumberFormat('@');
  }
  return sh;
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
    return sh;
  }
  return sheetHeadSync_(sh, name, headers);
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
