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
