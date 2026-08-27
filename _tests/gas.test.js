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
  eq(g.HEADERS.PICKS.length, 26);   /* 14 เดิม + 12 ช่องตลาด (Over/BTTS/HT/1X2/DB/HT-FT) */
  eq(g.HEADERS.PICKS[14], 'เรท Over');
  eq(g.HEADERS.PICKS[18], 'HT เรท');
  eq(g.HEADERS.BETS.length, 25);
  eq(g.HEADERS.TEAMS.length, 2);
  eq(g.HEADERS.BETS[0], 'ID');
  eq(g.HEADERS.BETS[1], 'Parent_ID');
  eq(g.HEADERS.BETS[2], 'Bill_Type');
});

/* ชีตจริงเกิดมาตอนหัวตารางมี 14 ช่อง พอเพิ่มช่องใหม่ในโค้ด ชีตเก่าไม่รู้เรื่องด้วย
   ค่าที่เขียนลงไปจะอ่านกลับไม่ได้เลย (readObjects_ ตั้งชื่อคีย์จากแถว 1) */
const HEAD_OLD_PICKS = ['ID','วันที่','ช่อง','ลีก','ทีมเหย้า','ทีมเยือน','เวลาเตะ',
  'เดาผล','เดาสกอร์','เปอร์เซ็นต์','ราคา','สกอร์จริง','ถูกผิด','สร้างเมื่อ'];

test('ชีตเก่าที่หัวตารางยังไม่ครบ ต้องถูกเติมหัวที่ขาด "ต่อท้าย"', () => {
  const g = env({ PICKS: [HEAD_OLD_PICKS.slice(), HEAD_OLD_PICKS.map(() => 'x')] });
  g.sheetEnsure_('PICKS', g.HEADERS.PICKS);
  const head = g.__book().sheets['PICKS'].rows[0];
  eq(head.length, 26);
  eq(head.slice(0, 14).join('|'), HEAD_OLD_PICKS.join('|'), 'ของเดิมห้ามสลับ/หาย');
  eq(head.slice(14).join('|'), 'เรท Over|เรท BTTS YES|HT เดาผล|HT %|HT เรท|1X2 %|Over %|BTTS YES %|DB %|DB เดาผล|HT/FT %|HT/FT เดาผล');
  eq(g.__book().sheets['PICKS'].rows.length, 2, 'แถวข้อมูลเดิมต้องอยู่ครบ');
});

test('หัวที่เติมทีหลัง ต้องถูกตั้ง @ ด้วย ไม่งั้นเรท +150 กลายเป็นเลข 150', () => {
  const g = env({ PICKS: [HEAD_OLD_PICKS.slice()] });
  const sh = g.sheetEnsure_('PICKS', g.HEADERS.PICKS);
  const row = g.HEADERS.PICKS.map(() => '');
  row[g.HEADERS.PICKS.indexOf('เรท Over')] = '+150';
  row[g.HEADERS.PICKS.indexOf('HT เรท')] = '-105';
  sh.appendRow(row);
  const out = g.readObjects_('PICKS')[0];
  eq(out['เรท Over'], '+150');
  eq(out['HT เรท'], '-105');
});

test('เรียกซ้ำ = หัวตารางต้องไม่งอกเพิ่ม (ครบแล้วไม่ต้องเติม)', () => {
  const g = env({ PICKS: [HEAD_OLD_PICKS.slice()] });
  g.sheetEnsure_('PICKS', g.HEADERS.PICKS);
  g.sheetEnsure_('PICKS', g.HEADERS.PICKS);
  g.sheetEnsure_('PICKS', g.HEADERS.PICKS);
  eq(g.__book().sheets['PICKS'].rows[0].length, 26, 'ห้ามต่อท้ายซ้ำ');
});

function apiEnv(book, props) {
  const P = Object.assign({ SHEET_ID: 'S' }, props || {});
  return loadGas(['gas/Config.gs', 'gas/Sheets.gs', 'gas/Forebet.gs', 'gas/Live.gs',
                  'gas/Settle.gs', 'gas/Api.gs'], {
    CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
    SpreadsheetApp: new FakeSpreadsheetApp(book),
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in P ? P[k] : null) }) },
    Utilities: { formatDate: () => '2026-08-25T18:00:00' },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: t => ({ _t: t, setMimeType() { return this; }, getContent() { return this._t; } })
    }
  });
}
function betRow(o) {
  const g = { 'ID':'', 'Parent_ID':'', 'Bill_Type':'MAIN', 'วันที่':'2026-08-25', 'ลีก':'', 
    'ทีมเหย้า':'', 'ทีมเยือน':'', 'ทีมที่เลือก':'', 'คู่แข่ง':'', 'ตลาด':'AH', 'แฮนดิแคป':0,
    'เส้น':'', 'ทายสกอร์':'', 'ราคา':1.9, 'เงิน':100, 'เวลาเตะ':'2026-08-25T21:45:00+07:00',
    'สถานะ':'จบ', 'สกอร์เหย้า':1, 'สกอร์เยือน':0, 'ผล':'WIN_FULL', 'กำไร':90,
    'Telegram_Message_ID':'', 'กุญแจกันซ้ำ':'', 'สร้างเมื่อ':'', 'อัปเดตเมื่อ':'' };
  return Object.assign(g, o);
}
function bookOf(bets, teams) {
  return {
    BETS: [HEAD_BETS].concat(bets.map(b => HEAD_BETS.map(h => b[h]))),
    TEAMS: [['ชื่ออังกฤษ','ชื่อไทย']].concat(teams || [])
  };
}
const HEAD_BETS = ['ID','Parent_ID','Bill_Type','วันที่','ลีก','ทีมเหย้า','ทีมเยือน',
  'ทีมที่เลือก','คู่แข่ง','ตลาด','แฮนดิแคป','เส้น','ทายสกอร์','ราคา','เงิน','เวลาเตะ',
  'สถานะ','สกอร์เหย้า','สกอร์เยือน','ผล','กำไร','Telegram_Message_ID','กุญแจกันซ้ำ',
  'สร้างเมื่อ','อัปเดตเมื่อ'];

test('nestBets_ บิลย่อยเข้าไปอยู่ใต้บิลแม่ ไม่โผล่เป็นใบเดี่ยว', () => {
  const g = apiEnv(bookOf([
    betRow({ 'ID':'B1' }),
    betRow({ 'ID':'B2', 'Parent_ID':'B1', 'Bill_Type':'SUB', 'เงิน':150, 'กำไร':-150 })
  ]));
  const out = g.nestBets_(g.readObjects_('BETS'), {});
  eq(out.length, 1, 'ต้องเหลือใบแม่ใบเดียวบนสุด');
  eq(out[0].subs.length, 1);
  eq(out[0]['รวมเงิน'], 250);
  eq(out[0]['รวมกำไร'], -60);
});

test('nestBets_ บิลย่อยที่หาแม่ไม่เจอ ต้องเด้งขึ้นมาเป็นใบเดี่ยว ห้ามหายเงียบ', () => {
  const g = apiEnv(bookOf([ betRow({ 'ID':'B9', 'Parent_ID':'ไม่มีจริง', 'Bill_Type':'SUB' }) ]));
  const out = g.nestBets_(g.readObjects_('BETS'), {});
  eq(out.length, 1);
  eq(out[0]['ID'], 'B9');
});

test('nestBets_ เติมชื่อไทยจากตาราง TEAMS แปลไม่เจอปล่อยว่าง', () => {
  const g = apiEnv(bookOf([ betRow({ 'ID':'B1', 'ทีมเหย้า':'Milan', 'ทีมเยือน':'Nowhere FC' }) ],
                          [['Milan','มิลาน']]));
  const out = g.nestBets_(g.readObjects_('BETS'), g.teamMap_());
  eq(out[0]['เหย้าไทย'], 'มิลาน');
  eq(out[0]['เยือนไทย'], '');
});

test('ledgerStats_ นับชนะครึ่งเป็นครึ่งใบ', () => {
  const g = apiEnv(bookOf([]));
  const s = g.ledgerStats_([
    { 'ผล':'WIN_FULL', 'เงิน':100, 'กำไร':90, 'วันที่':'2026-08-01' },
    { 'ผล':'WIN_HALF', 'เงิน':100, 'กำไร':45, 'วันที่':'2026-08-01' },
    { 'ผล':'LOSS_FULL','เงิน':100, 'กำไร':-100,'วันที่':'2026-08-02' }
  ]);
  eq(s['จำนวนใบ'], 3);
  eq(s['ลงไปทั้งหมด'], 300);
  eq(s['กำไรสะสม'], 35);
  eq(s['อัตราชนะ'], 0.5, '(1 + 0.5) ÷ 3');
});

test('ledgerStats_ คืนทุนไม่นับเป็นใบที่แพ้ ต้องตัดออกจากตัวหาร', () => {
  const g = apiEnv(bookOf([]));
  const s = g.ledgerStats_([
    { 'ผล':'WIN_FULL','เงิน':100,'กำไร':90,'วันที่':'2026-08-01' },
    { 'ผล':'PUSH',    'เงิน':100,'กำไร':0, 'วันที่':'2026-08-01' }
  ]);
  eq(s['อัตราชนะ'], 1, '1 ÷ (2 − 1 คืนทุน)');
});

test('ledgerStats_ ยังไม่มีใบที่รู้ผล = อัตราชนะเป็น null ไม่ใช่ NaN', () => {
  const g = apiEnv(bookOf([]));
  const s = g.ledgerStats_([{ 'ผล':'', 'เงิน':100, 'กำไร':'', 'วันที่':'2026-08-01' }]);
  eq(s['จำนวนใบ'], 0);
  eq(s['อัตราชนะ'], null);
});

test('ledgerStats_ เส้นกราฟเป็นยอดสะสม เรียงวันเก่าไปใหม่', () => {
  const g = apiEnv(bookOf([]));
  const s = g.ledgerStats_([
    { 'ผล':'LOSS_FULL','เงิน':100,'กำไร':-100,'วันที่':'2026-08-02' },
    { 'ผล':'WIN_FULL', 'เงิน':100,'กำไร':90, 'วันที่':'2026-08-01' },
    { 'ผล':'WIN_FULL', 'เงิน':100,'กำไร':90, 'วันที่':'2026-08-03' }
  ]);
  eq(s['เส้นกราฟ'].map(p => p['วันที่']).join(','), '2026-08-01,2026-08-02,2026-08-03');
  eq(s['เส้นกราฟ'].map(p => p['สะสม']).join(','), '90,-10,80');
});

test('doGet?p=ping ตอบได้ตั้งแต่ยังไม่มีข้อมูล', () => {
  const g = apiEnv({});
  const j = JSON.parse(g.doGet({ parameter: { p: 'ping' } }).getContent());
  eq(j.ok, true);
});

test('doGet พังต้องตอบเป็น JSON ok:false ไม่ใช่หน้า error ของกูเกิล', () => {
  const g = loadGas(['gas/Config.gs', 'gas/Sheets.gs', 'gas/Forebet.gs', 'gas/Api.gs'], {
    SpreadsheetApp: new FakeSpreadsheetApp({}),
    // ผ่านด่านกุญแจมาแล้ว (มี APP_KEY) แต่ยังไม่ได้ตั้ง SHEET_ID
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k === 'APP_KEY' ? 'kk' : null) }) },
    Utilities: { formatDate: () => '2026-08-25T18:00:00' },
    ContentService: { MimeType: { JSON: 'json' },
      createTextOutput: t => ({ _t: t, setMimeType() { return this; }, getContent() { return this._t; } }) }
  });
  const j = JSON.parse(g.doGet({ parameter: { k: 'kk' } }).getContent());
  eq(j.ok, false);
  ok(String(j.error).indexOf('SHEET_ID') >= 0, 'ต้องบอกสาเหตุจริง');
});

test('payloadAll_ ได้รูปร่างตามที่ล็อกไว้', () => {
  const g = apiEnv(bookOf([ betRow({ 'ID':'B1' }) ]));
  const p = g.payloadAll_();
  eq(p.ok, true);
  ok(Array.isArray(p.picks) && Array.isArray(p.bets));
  ok(typeof p.at === 'string' && p.at.indexOf('+07:00') > 0, 'เวลาเป็น +07:00');
  ok(p.ledger && 'อัตราชนะ' in p.ledger);
});

/* ---- ชีตกลืนข้อความให้กลายเป็นวันที่ ทางออกต้องคายกลับเป็นข้อความเสมอ ----
   ของจริงที่เจ้าของเห็นบนการ์ด: "30 ธ.ค. 42" (เวลา 02:18 โดนนับเป็นวันที่ 1899)
   และ "Sun Mar 01 2026 ..." (สกอร์ "3-1" โดนอ่านเป็นวันที่ 1 มี.ค.)
   สกอร์กู้กลับไม่ได้ (1 มี.ค. เป็นได้ทั้ง 3-1 และ 1-3) = ต้องปล่อยว่าง ห้ามเดาให้ */
test('pickOut_ กันวันที่ปลอมจากชีต — เวลาเตะกลับมาเป็น HH:MM สกอร์ที่โดนกลืนปล่อยว่าง', () => {
  const g = apiEnv(bookOf([]));
  const out = g.pickOut_({
    'ID': 'P1',
    'วันที่': new Date(2026, 7, 27),
    'เวลาเตะ': new Date(1899, 11, 30, 2, 18),
    'เดาสกอร์': new Date(2026, 2, 1),
    'สร้างเมื่อ': new Date(2026, 7, 26, 15, 43)
  }, {});
  eq(out['วันที่'], '2026-08-27');
  eq(out['เวลาเตะ'], '02:18', 'ห้ามคาย 30 ธ.ค. 42 ออกไปให้หน้าเว็บ');
  eq(out['เดาสกอร์'], '', 'กู้ไม่ได้ = ว่าง ดีกว่าเดาผิดข้าง');
  ok(out['ดึงเมื่อ'].indexOf('+07:00') > 0, 'สร้างเมื่อเป็นเวลาจริง แปลงเป็นข้อความได้');
});

test('pickOut_ ของที่เป็นข้อความอยู่แล้วต้องผ่านเหมือนเดิม + ช่องตลาดใหม่ครบ', () => {
  const g = apiEnv(bookOf([]));
  const out = g.pickOut_({
    'วันที่': '2026-08-27', 'เวลาเตะ': '00:00', 'เดาสกอร์': '3-1',
    '1X2 %': '42/38/20', 'Over %': '77', 'BTTS YES %': '58',
    'HT เดาผล': '1', 'HT %': '41/36/23', 'HT เรท': '-',
    'DB %': '80', 'DB เดาผล': '1X', 'HT/FT %': '17', 'HT/FT เดาผล': '1/1'
  }, {});
  eq(out['วันที่'] + ' ' + out['เวลาเตะ'] + ' ' + out['เดาสกอร์'], '2026-08-27 00:00 3-1');
  eq(out['1X2เปอร์เซ็นต์'], '42/38/20');
  eq(out['Overเปอร์เซ็นต์'] + '|' + out['BTTSเปอร์เซ็นต์'], '77|58');
  eq(out['DBเปอร์เซ็นต์'] + '/' + out['DBเดาผล'], '80/1X');
  eq(out['HTFTเปอร์เซ็นต์'] + '(' + out['HTFTเดาผล'] + ')', '17(1/1)');
});

/* ---- ด่านกุญแจ (ห้ามให้คนอื่นอ่านบิลได้จาก URL เปล่า) ---- */

const KEYBOOK = () => bookOf([betRow({ ID: 'B1', เงิน: 100, กำไร: 90 })], [['Arsenal', 'อาร์เซนอล']]);
const getJson = (g, q) => JSON.parse(g.doGet({ parameter: q }).getContent());

test('ไม่ได้ตั้ง APP_KEY = ปิดตาย ไม่ใช่เปิดหมด (fail-closed)', () => {
  const g = apiEnv(KEYBOOK());                       // ไม่มี APP_KEY ในพร็อพเพอร์ตี้
  const r = getJson(g, { p: 'all' });
  eq(r.ok, false, 'ยังไม่ตั้งกุญแจต้องไม่คายข้อมูล');
  eq(r.needKey, true);
});

test('ตั้ง APP_KEY แล้ว แต่ไม่ส่งกุญแจมา = ปฏิเสธ', () => {
  const g = apiEnv(KEYBOOK(), { APP_KEY: 'ss1234' });
  const r = getJson(g, { p: 'all' });
  eq(r.ok, false);
  eq(r.needKey, true);
});

test('ส่งกุญแจผิด = ปฏิเสธ', () => {
  const g = apiEnv(KEYBOOK(), { APP_KEY: 'ss1234' });
  eq(getJson(g, { p: 'all', k: 'ss1235' }).ok, false);
});

test('ส่งกุญแจถูก = ได้ข้อมูล', () => {
  const g = apiEnv(KEYBOOK(), { APP_KEY: 'ss1234' });
  const r = getJson(g, { p: 'all', k: 'ss1234' });
  eq(r.ok, true);
  eq(r.bets.length, 1);
});

test('ตอนปฏิเสธห้ามมีเศษข้อมูลบิลติดออกไปเลย', () => {
  const g = apiEnv(KEYBOOK(), { APP_KEY: 'ss1234' });
  const raw = g.doGet({ parameter: { p: 'all' } }).getContent();
  ok(raw.indexOf('bets') < 0, 'ไม่ควรมีคำว่า bets');
  ok(raw.indexOf('อาร์เซนอล') < 0, 'ไม่ควรมีชื่อทีม');
  ok(raw.indexOf('ss1234') < 0, 'ห้ามบอกกุญแจที่ถูกต้องออกไป');
});

test('ping ยังเช็คได้โดยไม่ต้องมีกุญแจ (ไว้ดูว่า deploy ติดไหม) แต่ต้องไม่มีข้อมูล', () => {
  const g = apiEnv(KEYBOOK(), { APP_KEY: 'ss1234' });
  const r = getJson(g, { p: 'ping' });
  eq(r.ok, true);
  eq(r.bets, undefined);
  eq(r.ledger, undefined);
});

/* ping เป็นทางเดียวที่ไม่ต้องใช้กุญแจ จึงเป็นที่เดียวที่ไล่ปัญหาได้ตอนไม่มีกุญแจในมือ
   แต่ห้ามให้มันกลายเป็นรูรั่ว — คายได้แค่ตัวเลขกับสาเหตุ */
test('ping ต้องพ่วงกล่องดำของรอบดึงล่าสุดมาด้วย', () => {
  const g = apiEnv(KEYBOOK(), { APP_KEY: 'ss1234', FB_LAST_REPORT:
    JSON.stringify({ at: '2026-08-26T10:00:00+07:00', ok: false, code: 429, added: 0, error: 'โดนปฏิเสธ' }) });
  const r = getJson(g, { p: 'ping' });
  eq(r.ok, true);
  eq(r['ดึงล่าสุด'].code, 429);
});

test('ยังไม่เคยดึงเลย = ping ต้องยังตอบได้ ไม่ใช่พัง', () => {
  const g = apiEnv(KEYBOOK(), { APP_KEY: 'ss1234' });
  const r = getJson(g, { p: 'ping' });
  eq(r.ok, true);
  eq(r['ดึงล่าสุด'], null);
});

test('ping ห้ามคายกุญแจหรือข้อมูลบิลออกไป', () => {
  const g = apiEnv(KEYBOOK(), { APP_KEY: 'ss1234' });
  const raw = g.doGet({ parameter: { p: 'ping' } }).getContent();
  ok(raw.indexOf('ss1234') < 0, 'ห้ามมีกุญแจ');
  ok(raw.indexOf('bets') < 0, 'ห้ามมีบิล');
});

/* ping ออกไปดึงเองได้ (ของสาธารณะล้วน) แต่ห้ามคายของในชีตกลับมา
   มีไว้เพื่อให้ไล่ปัญหาได้โดยไม่ต้องรอเจ้าของเปิดแอปให้ */
test('ping ที่ถึงคิวแล้ว = ออกไปดึงเอง แล้วรายงานผลกลับมา', () => {
  const g = apiEnv(KEYBOOK(), { APP_KEY: 'ss1234' });
  let hit = 0;
  g.fbAutoSnap_ = () => { hit++; return false; };
  const r = getJson(g, { p: 'ping' });
  eq(r.ok, true);
  eq(hit, 1, 'ต้องเรียกตัวดึงจริง');
});

test('ชีตพัง = ping ต้องยังตอบ ok ไม่ใช่ล้มทั้งทาง', () => {
  const g = apiEnv(KEYBOOK(), { APP_KEY: 'ss1234' });
  g.readObjects_ = () => { throw new Error('ชีตหาย'); };
  eq(getJson(g, { p: 'ping' }).ok, true);
});

/* AUTH = ปุ่มให้เจ้าของกดอนุญาตครั้งเดียว ต้องไม่พังไม่ว่าสิทธิ์จะขาดข้อไหน
   ถ้ามันโยน error ทิ้ง เจ้าของจะเห็นแต่กล่องแดง ไม่รู้ว่าติดตรงไหน */
test('AUTH ต้องรายงานเป็นข้อความเสมอ แม้ออกเน็ตไม่ได้', () => {
  const g = loadGas(['gas/Config.gs', 'gas/Sheets.gs', 'gas/Setup.gs'], {
    UrlFetchApp: { fetch: () => { throw new Error('ไม่ได้รับอนุญาต'); } }
  });
  const msg = g.AUTH();
  eq(typeof msg, 'string');
  ok(msg.indexOf('ออกเน็ตไม่ได้') === 0, 'ต้องบอกว่าออกเน็ตไม่ได้');
});

/* ผลของการกดปุ่มต้องถูกจดไว้ ไม่งั้นคนนอกเอดิเตอร์ตรวจไม่ได้ว่าเจ้าของกดไปแล้วหรือยัง */
test('AUTH ต้องจดผลลง AUTH_LOG', () => {
  const g = loadGas(['gas/Config.gs', 'gas/Sheets.gs', 'gas/Setup.gs'], {
    UrlFetchApp: { fetch: () => { throw new Error('ไม่ได้รับอนุญาต'); } }
  });
  g.AUTH();
  const log = g.PropertiesService.getScriptProperties().getProperty('AUTH_LOG');
  ok(log && log.indexOf('ออกเน็ตไม่ได้') >= 0, 'ต้องมีผลอยู่ใน AUTH_LOG: ' + log);
});
