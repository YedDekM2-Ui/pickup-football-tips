/* ---------- AUTH: กดครั้งเดียวตอนสิทธิ์ยังไม่ครบ ----------
   ที่ต้องมี: Apps Script จำ "ใบอนุญาต" ไว้ตอนที่เจ้าของกดอนุญาตครั้งแรก
   ตอนนั้นโค้ดยังไม่ออกเน็ต ใบเลยไม่มีข้อ "ออกเน็ตได้" ติดมาด้วย
   พอโค้ดมาออกเน็ตทีหลัง มันจึงโดนปฏิเสธทุกครั้ง (UrlFetchApp ... script.external_request)
   การดีพลอยใหม่ไม่ช่วย เพราะใบอนุญาตผูกกับ "คนกดอนุญาต" ไม่ใช่ผูกกับเวอร์ชัน
   วิธีเดียวคือเจ้าของกด Run ฟังก์ชันนี้ 1 ครั้งแล้วกดอนุญาต — ทำครั้งเดียวจบ
   ฟังก์ชันนี้แตะครบทุกสิทธิ์ที่ระบบใช้จริง (ออกเน็ต + ชีต) จะได้ขออนุญาตรวดเดียว */
function AUTH() {
  var out = [];
  try {
    var r = UrlFetchApp.fetch('https://www.google.com/generate_204', { muteHttpExceptions: true });
    out.push('ออกเน็ตได้ (' + r.getResponseCode() + ')');
  } catch (err) {
    out.push('ออกเน็ตไม่ได้: ' + (err && err.message ? err.message : err));
  }
  try {
    var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    out.push(id ? 'ชีตเปิดได้ (' + SpreadsheetApp.openById(id).getName() + ')' : 'ยังไม่มี SHEET_ID');
  } catch (err) {
    out.push('ชีตเปิดไม่ได้: ' + (err && err.message ? err.message : err));
  }
  var msg = out.join(' · ');
  /* จดผลลงกล่องเก็บของสคริปต์ด้วย เพื่อให้ ?p=ping อ่านได้จากข้างนอก
     ไม่งั้นผลของการกดปุ่มนี้เห็นได้แค่ในหน้าเอดิเตอร์ของเจ้าของคนเดียว
     ทำให้แยกไม่ออกว่า "ยังไม่ได้กดอนุญาต" หรือ "กดแล้วแต่เว็บแอปยังไม่ได้ใบ" */
  var when = '';
  try { when = nowIso_(); } catch (err) { when = ''; }   /* หาเวลาไม่ได้ ก็ยังต้องจดผลให้ได้ */
  try {
    PropertiesService.getScriptProperties()
      .setProperty('AUTH_LOG', (when ? when + ' — ' : '') + msg);
  } catch (err) { /* จดไม่ได้ก็ยังต้องคืนคำตอบให้คนกดอ่าน */ }
  return msg;
}

/* Setup.gs — รันมือครั้งเดียวตอนตั้งระบบ
   ถ้ายังไม่มี SHEET_ID มันสร้างสเปรดชีตให้เอง เจ้าของไม่ต้องไปสร้าง/ก๊อป ID เอง */
function setupSheets() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  if (!id) {
    var ss = SpreadsheetApp.create('Pickup Football Tips — ฐานข้อมูล');
    id = ss.getId();
    props.setProperty('SHEET_ID', id);
  }
  sheetEnsure_(SHEETS.PICKS, HEADERS.PICKS);
  sheetEnsure_(SHEETS.BETS,  HEADERS.BETS);
  sheetEnsure_(SHEETS.TEAMS, HEADERS.TEAMS);
  var url = SpreadsheetApp.openById(id).getUrl();
  Logger.log('ชีตพร้อมแล้ว: ' + url);
  return url;
}
