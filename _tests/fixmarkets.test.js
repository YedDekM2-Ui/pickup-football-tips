/* fixmarkets.test.js — ซ่อมช่องตลาดของ "คู่ปักหมุด" ที่ชีตกลืนเป็นวันที่ไปแล้ว

   อาการที่เจ้าของเห็นกับตา: การ์ดโชว์ "HT/FT 17" ห้วนๆ ไม่มี (1/1) ต่อท้าย
   ต้นเหตุ 3 ทอด:
     1. ชีตกลืน "1/1" เป็นวันที่ 1 ม.ค. (แถวนั้นเขียนก่อนมี sheetTextFix_)
     2. noDate_ อ่านเจอ Date เลยคืนค่าว่าง (ถูกแล้ว — กลืนไปแล้วเดาคืนไม่ได้ กฎข้อ 6)
     3. คู่เดิมโดนด่านกันซ้ำเด้งทุกรอบ = ไม่มีใครเติมกลับให้เลยสักที  <-- ไฟล์นี้ปิดรูนี้

   ที่ต้องพิสูจน์ (ห้ามพังของเดิม):
     - ช่องที่โดนกลืน/ว่าง เท่านั้นที่เติม
     - ช่องที่ยังอ่านออกอยู่ ห้ามทับเด็ดขาด (ภาพนิ่งของคู่ปักหมุด)
     - แถวที่มีสกอร์จริงแล้ว = จบไปแล้ว ห้ามแตะ
     - ไม่มีอะไรเสีย = ห้ามยิงเน็ตแม้แต่ครั้งเดียว
*/

const { loadGas, fakeResponse } = require('./gasEnv');
const fs = require('fs');
const path = require('path');
const { FakeSpreadsheetApp } = require('./fakeSheet');

const REAL = fs.readFileSync(path.join(__dirname, 'fixtures', 'forebet-real.html'), 'utf8');
const MATCH2 = fs.readFileSync(path.join(__dirname, 'fixtures', 'forebet-match2.html'), 'utf8');
const MATCH2_ID = '2504066';

/* หัวตารางเต็มชุดตาม HEADERS.PICKS — bookOf ของ forebet.test.js มีแค่ 14 ช่อง
   ไม่มีช่องตลาดเลย จึงเอามาใช้กับเรื่องนี้ไม่ได้ */
const HEAD = ['ID','วันที่','ช่อง','ลีก','ทีมเหย้า','ทีมเยือน','เวลาเตะ',
  'เดาผล','เดาสกอร์','เปอร์เซ็นต์','ราคา','สกอร์จริง','ถูกผิด','สร้างเมื่อ',
  'เรท Over','เรท BTTS YES','HT เดาผล','HT %','HT เรท',
  '1X2 %','Over %','BTTS YES %','DB %','DB เดาผล','HT/FT %','HT/FT เดาผล'];

function row(o) {
  const g = {};
  HEAD.forEach(h => { g[h] = ''; });
  g['วันที่'] = '2026-08-27';
  g['เปอร์เซ็นต์'] = 0;
  g['ราคา'] = 0;
  g['สร้างเมื่อ'] = '2026-08-26T12:00:00+07:00';
  return Object.assign(g, o);
}
function book(rows) {
  return {
    PICKS: [HEAD].concat((rows || []).map(r => HEAD.map(h => r[h]))),
    TEAMS: [['ชื่ออังกฤษ','ชื่อไทย'], ['Arsenal','อาร์เซนอล']]
  };
}

/** กล่องเทสต์ที่ "นับครั้งที่ยิงเน็ต" ได้ และตอบตาม URL ที่ขอ
    ต้องแยกหน้าแรกกับหน้าของคู่ ไม่งั้นตัวอ่านตลาดไม่มีของให้แกะ */
function env(bk, fetchFn) {
  const app = new FakeSpreadsheetApp(bk);
  const calls = [];
  const g = loadGas(['gas/Config.gs', 'gas/Sheets.gs', 'gas/Forebet.gs', 'gas/Api.gs'], {
    SpreadsheetApp: app,
    Utilities: { formatDate: () => '2026-08-27T18:00:00' },
    UrlFetchApp: {
      fetch: (url, opt) => { calls.push(String(url)); return fetchFn(String(url), opt); }
    }
  });
  g.PropertiesService.getScriptProperties().setProperty('SHEET_ID', 'S');
  g.__app = app;
  g.__calls = calls;
  return g;
}

/** ตอบหน้าของคู่เมื่อถูกขอหน้าของคู่ นอกนั้นตอบหน้าแรก */
function serve(matchHtml) {
  return (url) => fakeResponse(200, url.indexOf('/matches/') >= 0 ? matchHtml : REAL);
}

/** สนามเทสต์ตัวซ่อมแบบเดี่ยวๆ — คู่สมมติ 1 คู่ ที่ลิงก์ชี้ไปหน้าคู่จริงในกล่องตัวอย่าง */
const LINK = 'https://www.forebet.com/en/football/matches/x-' + MATCH2_ID;
const SNAP = {
  'ทีมเหย้า': 'Czarni Sosnowiec W',
  'ทีมเยือน': 'OH Leuven W',
  'รหัสคู่': MATCH2_ID,
  'ลิงก์': LINK
};
function snap() { return Object.assign({}, SNAP); }
function pair(o) {
  return row(Object.assign({ 'ช่อง': 'FEATURED',
    'ทีมเหย้า': SNAP['ทีมเหย้า'], 'ทีมเยือน': SNAP['ทีมเยือน'] }, o));
}
function nFetch(g) { return g.__calls.length; }
function only(g) { return g.readObjects_('PICKS')[0]; }

test('ช่องที่ชีตกลืนเป็นวันที่ ต้องเติมกลับได้ — นี่คือ (1/1) ที่หายไปจากการ์ด', () => {
  const g = env(book([pair({ 'HT/FT เดาผล': new Date(2026, 0, 1) })]), serve(MATCH2));

  const n = g.fbFixMarkets_(snap());
  ok(n > 0, 'ต้องรายงานว่าซ่อมไปกี่ช่อง');

  const r = only(g);
  eq(r['HT/FT เดาผล'], '2/2', 'ของที่โดนกลืนต้องกลับมาเป็นข้อความเหมือนเดิม');
  eq(r['HT/FT %'], '51', 'ช่องว่างข้างๆ ก็เติมให้ในรอบเดียวกัน');
  eq(r['Over %'], '77');
  eq(r['BTTS YES %'], '82');
  eq(r['HT เดาผล'], '2');
  eq(r['DB %'], '83');
  eq(r['DB เดาผล'], '21');
  eq(typeof r['HT/FT เดาผล'], 'string', 'ต้องลงเป็นข้อความ ไม่งั้นชีตกลืนซ้ำอีกรอบ');
});

test('ช่องที่ยังอ่านออกอยู่ ห้ามทับ — ภาพนิ่งของคู่ปักหมุดต้องไม่ขยับ', () => {
  const g = env(book([pair({
    'HT/FT เดาผล': '1/1',                 /* ของเดิมอ่านออก แม้หน้าเว็บวันนี้จะบอก 2/2 */
    'DB เดาผล': 'X2',
    'HT/FT %': new Date(2026, 0, 1)       /* อันนี้เสีย ต้องซ่อม */
  })]), serve(MATCH2));

  ok(g.fbFixMarkets_(snap()) > 0);

  const r = only(g);
  eq(r['HT/FT เดาผล'], '1/1', 'ห้ามเอาคำทำนายรอบใหม่มาทับของเดิม');
  eq(r['DB เดาผล'], 'X2', 'เหมือนกัน');
  eq(r['HT/FT %'], '51', 'ช่องที่เสียจริงถึงจะเติม');
});

test('แถวที่มีสกอร์จริงแล้ว = จบไปแล้ว ห้ามแตะ และห้ามยิงเน็ตเปล่า', () => {
  const g = env(book([pair({ 'สกอร์จริง': '1-3', 'HT/FT เดาผล': new Date(2026, 0, 1) })]),
                serve(MATCH2));

  eq(g.fbFixMarkets_(snap()), 0, 'ไม่ซ่อมสักช่อง');
  eq(nFetch(g), 0, 'ไม่มีอะไรต้องซ่อม = ห้ามเปิดหน้าคู่ให้เสียเน็ตฟรี');
  ok(only(g)['HT/FT เดาผล'] instanceof Date, 'ของเดิมอยู่ที่เดิม');
});

test('ครบทุกช่องอยู่แล้ว = คืน 0 และไม่ยิงเน็ตเลย', () => {
  const full = {};
  ['เดาสกอร์','เรท Over','เรท BTTS YES','HT เดาผล','HT %','HT เรท',
   '1X2 %','Over %','BTTS YES %','DB %','DB เดาผล','HT/FT %','HT/FT เดาผล']
    .forEach(k => { full[k] = 'x'; });
  const g = env(book([pair(full)]), serve(MATCH2));

  eq(g.fbFixMarkets_(snap()), 0);
  eq(nFetch(g), 0);
});

test('ไม่รู้ว่าคู่ไหน / ไม่เจอคู่ในชีต = ไม่แตะอะไรเลย', () => {
  const g = env(book([pair({ 'HT/FT เดาผล': new Date(2026, 0, 1) })]), serve(MATCH2));

  eq(g.fbFixMarkets_({ 'ลิงก์': LINK }), 0, 'ไม่มีชื่อทีม = ไม่มีกุญแจ = ไม่ซ่อม');
  eq(g.fbFixMarkets_({ 'ทีมเหย้า': 'ไม่มีคู่นี้', 'ทีมเยือน': 'ในชีต', 'ลิงก์': LINK }), 0);
  eq(nFetch(g), 0, 'ทั้งสองเคสต้องตัดจบก่อนถึงขั้นยิงเน็ต');
  ok(only(g)['HT/FT เดาผล'] instanceof Date, 'ของเดิมอยู่ครบ');
});

test('เปิดหน้าคู่ไม่ได้ = ไม่แตะชีต (ห้ามล้างของเดิมทิ้ง)', () => {
  const g = env(book([pair({ 'HT/FT เดาผล': new Date(2026, 0, 1) })]),
                (url) => fakeResponse(url.indexOf('/matches/') >= 0 ? 403 : 200, REAL));

  eq(g.fbFixMarkets_(snap()), 0, 'อ่านหน้าคู่ไม่ออก = ไม่มีของให้เติม');
  ok(only(g)['HT/FT เดาผล'] instanceof Date, 'ของเดิมต้องอยู่ที่เดิม ไม่ถูกล้างเป็นค่าว่าง');
});

test('เช็กช่องเสีย: ว่าง/ช่องว่างล้วน/Date = เสีย · เลข 0 กับข้อความ = ไม่เสีย', () => {
  const g = env(book([]), serve(MATCH2));
  eq(g.fbCellBad_(''), true);
  eq(g.fbCellBad_('   '), true);
  eq(g.fbCellBad_(null), true);
  eq(g.fbCellBad_(undefined), true);
  eq(g.fbCellBad_(new Date(2026, 0, 1)), true);
  eq(g.fbCellBad_('1/1'), false);
  eq(g.fbCellBad_(0), false, 'เลข 0 คือค่าที่อ่านออก ห้ามนับว่าเสีย');
  eq(g.fbCellBad_('0'), false);
});

test('รอบดึงจริง: คู่เดิมยังนับเป็น "ข้าม" เหมือนเดิม แต่ต้องซ่อมช่องตลาดให้ด้วย', () => {
  /* ยึดคู่ POTD ของหน้าจริง แล้วสลับรหัสคู่ในหน้าตลาดให้ตรงกับคู่นั้น
     (ป้ายตลาดฝังรหัสคู่ไว้ในตัวมันเอง ไม่ตรงกัน = หาไม่เจอ) */
  const probe = env(book([]), serve(MATCH2));
  const id = String(probe.fbParseOne_(REAL, 'POTD')['รหัสคู่'] || '');
  ok(id, 'ต้องอ่านรหัสคู่จากหน้าจริงได้ก่อน');

  const old = row({ 'ID': 'FB-POTD-1', 'ช่อง': 'POTD', 'ลีก': 'Primera A',
    'ทีมเหย้า': 'Cúcuta Deportivo', 'ทีมเยือน': 'Alianza Petrolera',
    'วันที่': '2026-08-26', 'เวลาเตะ': '10:00', 'เดาผล': 'X', 'เดาสกอร์': '1-1',
    'HT/FT เดาผล': new Date(2026, 0, 1) });

  const g = env(book([old]),
    serve(MATCH2.split(MATCH2_ID).join(id)));

  const r = g.fbSnapRun_();
  ok(r.skipped.indexOf('POTD') >= 0, 'คู่เดิมต้องยังนับเป็น "ข้าม" เหมือนเดิม');
  eq(g.__app.book.sheets.PICKS.rows.length - 1, 2, 'ห้ามเพิ่มแถวคู่เดิม');
  ok(r.fixed.join(' · ').indexOf('ตลาด=') >= 0, 'รายงานต้องบอกว่าซ่อมช่องตลาดไปด้วย');

  const got = g.readObjects_('PICKS').filter(x => x['ทีมเหย้า'] === 'Cúcuta Deportivo')[0];
  eq(got['HT/FT เดาผล'], '2/2', '(1/1) ที่หายไปจากการ์ด ต้องกลับมาเอง ไม่ต้องรอคนไปแก้ชีต');
  eq(got['เดาสกอร์'], '1-1', 'ภาพนิ่งคำทำนายของเดิมต้องอยู่ครบ');
  eq(got['ID'], 'FB-POTD-1', 'ช่องอื่นห้ามขยับ');
});
