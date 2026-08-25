const { loadGas } = require('./gasEnv');
const { FakeSpreadsheetApp } = require('./fakeSheet');

function env(book) {
  const app = new FakeSpreadsheetApp(book);
  return loadGas(['gas/Config.gs', 'gas/Sheets.gs'], {
    SpreadsheetApp: app,
    __book: () => app.book,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: k => ({ SHEET_ID: 'SHEET-TEST' })[k] || null,
        setProperty: () => {}
      })
    }
  });
}

test('sheetIfExists_ ไม่มีชีต = คืน null ห้ามสร้างชีตเปล่า', () => {
  const g = env({});
  eq(g.sheetIfExists_('PICKS'), null);
  eq(Object.keys(g.__book().sheets).length, 0, 'ห้ามมีชีตงอกมา');
});

test('readObjects_ ชีตไม่มี = คืนอาเรย์ว่าง ไม่ throw', () => {
  eq(env({}).readObjects_('BETS').length, 0);
});

test('readObjects_ แปลงหัวตารางเป็นคีย์ และข้ามแถวว่างล้วน', () => {
  const g = env({ TEAMS: [['ชื่ออังกฤษ','ชื่อไทย'], ['Milan','มิลาน'], ['',''], ['Inter','อินเตอร์']] });
  const rows = g.readObjects_('TEAMS');
  eq(rows.length, 2);
  eq(rows[0]['ชื่อไทย'], 'มิลาน');
  eq(rows[1]['ชื่ออังกฤษ'], 'Inter');
});

test('sheetEnsure_ สร้างชีตพร้อมหัวตารางครบตามที่ล็อกไว้', () => {
  const g = env({});
  g.sheetEnsure_('TEAMS', g.HEADERS.TEAMS);
  const s = g.__book().sheets['TEAMS'];
  ok(s, 'ต้องมีชีตใหม่');
  eq(s.rows[0].join('|'), 'ชื่ออังกฤษ|ชื่อไทย');
});

test('ช่องที่ต้องเป็นข้อความ ถูกบังคับ format @ ไม่งั้นชีตกินเลข 0 หน้า', () => {
  const g = env({});
  g.sheetEnsure_('BETS', g.HEADERS.BETS);
  const s = g.__book().sheets['BETS'];
  g.TEXT_COLS.BETS.forEach(name => {
    const i = g.HEADERS.BETS.indexOf(name) + 1;
    ok(s.textCols.indexOf(i) >= 0, 'ช่อง ' + name + ' ต้องเป็น @');
  });
});

test('อ่านค่าที่ตั้ง @ แล้ว ต้องได้ข้อความเดิม ไม่โดนแปลงเป็นเลข/วันที่', () => {
  const g = env({});
  const s = g.sheetEnsure_('BETS', g.HEADERS.BETS);
  const row = g.HEADERS.BETS.map(() => '');
  row[g.HEADERS.BETS.indexOf('ID')] = '0480';
  row[g.HEADERS.BETS.indexOf('วันที่')] = '2026-08-25';
  s.appendRow(row);
  const out = g.readObjects_('BETS')[0];
  eq(out['ID'], '0480', 'ห้ามกลายเป็น 480');
  eq(typeof out['วันที่'], 'string', 'ห้ามกลายเป็น Date');
});

test('sheetId_ ไม่ได้ตั้งค่า = ด่าออกมาเป็นภาษาคน ไม่ใช่ปล่อยพัง', () => {
  const g = loadGas(['gas/Config.gs', 'gas/Sheets.gs'], {
    SpreadsheetApp: new FakeSpreadsheetApp({}),
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) }
  });
  throws(() => g.sheetId_(), /SHEET_ID/);
});

test('หัวตารางทั้ง 3 ชีตตรงตามที่ล็อกไว้ในแผน', () => {
  const g = env({});
  eq(g.HEADERS.PICKS.length, 14);
  eq(g.HEADERS.BETS.length, 25);
  eq(g.HEADERS.TEAMS.length, 2);
  eq(g.HEADERS.BETS[0], 'ID');
  eq(g.HEADERS.BETS[1], 'Parent_ID');
  eq(g.HEADERS.BETS[2], 'Bill_Type');
});
