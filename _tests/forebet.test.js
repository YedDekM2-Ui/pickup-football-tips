/* forebet.test.js — ตัวดึง Featured / Pick of the day มาแช่ไว้หน้า 1
   ข้อที่ต้องพิสูจน์: ดึงไม่ได้ = ของเก่าในชีตต้องอยู่ครบ ห้ามหายห้ามถูกทับ */

const { loadGas, fakeResponse } = require('./gasEnv');
const { FakeSpreadsheetApp } = require('./fakeSheet');

const HEAD_PICKS = ['ID','วันที่','ช่อง','ลีก','ทีมเหย้า','ทีมเยือน','เวลาเตะ',
  'เดาผล','เดาสกอร์','เปอร์เซ็นต์','ราคา','สกอร์จริง','ถูกผิด','สร้างเมื่อ'];

function pickRow(o) {
  const g = { 'ID':'', 'วันที่':'2026-08-25', 'ช่อง':'', 'ลีก':'', 'ทีมเหย้า':'', 'ทีมเยือน':'',
    'เวลาเตะ':'', 'เดาผล':'', 'เดาสกอร์':'', 'เปอร์เซ็นต์':0, 'ราคา':0,
    'สกอร์จริง':'', 'ถูกผิด':'', 'สร้างเมื่อ':'2026-08-24T12:00:00+07:00' };
  return Object.assign(g, o);
}
function bookOf(picks) {
  return {
    PICKS: [HEAD_PICKS].concat((picks || []).map(p => HEAD_PICKS.map(h => p[h]))),
    TEAMS: [['ชื่ออังกฤษ','ชื่อไทย'], ['Arsenal','อาร์เซนอล']]
  };
}

/** หน้าเว็บปลอมที่หน้าตาเหมือนของ forebet พอให้ตัวอ่านทำงานได้ */
function pageHtml(a) {
  return '<html><body><div class="wrap">' +
    '<h2>Featured match</h2>' +
    '<div class="rcnt"><span class="shortTag">' + a.league1 + '</span>' +
      '<span class="homeTeam">' + a.home1 + '</span>' +
      '<span class="awayTeam">' + a.away1 + '</span>' +
      '<span class="forepr">1</span><span class="fprc">' + a.pct1 + '%</span>' +
      '<span class="ex_sc">' + a.sc1 + '</span><span class="lscrsp">' + a.odds1 + '</span>' +
      '<span class="date_bah">' + a.date1 + '</span></div>' +
    '<h2>Pick of the day</h2>' +
    '<div class="rcnt"><span class="shortTag">' + a.league2 + '</span>' +
      '<span class="homeTeam">' + a.home2 + '</span>' +
      '<span class="awayTeam">' + a.away2 + '</span>' +
      '<span class="forepr">X</span><span class="fprc">' + a.pct2 + '%</span>' +
      '<span class="ex_sc">' + a.sc2 + '</span><span class="lscrsp">' + a.odds2 + '</span>' +
      '<span class="date_bah">' + a.date2 + '</span></div>' +
    '</div>' + '<!--' + 'x'.repeat(1200) + '-->' + '</body></html>';
}
const PAGE_A = {
  league1: 'Premier League', home1: 'Arsenal', away1: 'Leeds',
  pct1: 71, sc1: '2-0', odds1: '1.42', date1: '25/08/2026',
  league2: 'Eredivisie', home2: 'PSV', away2: 'Sparta Rotterdam',
  pct2: 64, sc2: '1-1', odds2: '1.30', date2: '25/08/2026'
};
const PAGE_B = Object.assign({}, PAGE_A, { home1: 'Chelsea', away1: 'Everton' });

function fbEnv(book, body, code) {
  const app = new FakeSpreadsheetApp(book);
  const g = loadGas(['gas/Config.gs', 'gas/Sheets.gs', 'gas/Forebet.gs', 'gas/Api.gs'], {
    SpreadsheetApp: app,
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: k => ({ SHEET_ID: 'S' })[k] || null })
    },
    Utilities: { formatDate: () => '2026-08-25T18:00:00' },
    UrlFetchApp: { fetch: () => fakeResponse(code === undefined ? 200 : code, body) }
  });
  g.__app = app;
  return g;
}
/** จำนวนแถวข้อมูลในแท็บ PICKS (ไม่นับหัวตาราง) */
function nPicks(g) { return g.__app.book.sheets.PICKS.rows.length - 1; }

test('อ่านหน้าเว็บออก = ได้ทั้ง 2 ช่อง พร้อมทีม/เปอร์เซ็นต์/ราคา', () => {
  const g = fbEnv(bookOf([]), pageHtml(PAGE_A));
  const r = g.fbSnapRun_();
  eq(r.ok, true);
  eq(r.missed.length, 0, 'ต้องอ่านออกทั้งคู่');
  eq(r.added.length, 2);
  eq(nPicks(g), 2, 'ต้องจดลงชีต 2 แถว');

  const rows = g.readObjects_('PICKS');
  const feat = rows.filter(x => x['ช่อง'] === 'FEATURED')[0];
  eq(feat['ทีมเหย้า'], 'Arsenal');
  eq(feat['ทีมเยือน'], 'Leeds');
  eq(String(feat['เดาผล']), '1', 'ชีตจริงกลืน 1 เป็นตัวเลข — ทาง pickOut_ String() ทับอยู่แล้ว');
  eq(feat['เดาสกอร์'], '2-0');
  eq(Number(feat['เปอร์เซ็นต์']), 71);
  eq(Number(feat['ราคา']), 1.42);
  eq(String(feat['เวลาเตะ']), '', 'ไม่รู้เขตเวลาเขา = ปล่อยว่าง ห้ามเดา');

  const potd = rows.filter(x => x['ช่อง'] === 'POTD')[0];
  eq(potd['ทีมเหย้า'], 'PSV');
  eq(potd['เดาผล'], 'X');
});

test('คู่เดิมยังอยู่ = ไม่จดซ้ำ และห้ามแก้ตัวเลขของแถวเก่า', () => {
  const g = fbEnv(bookOf([]), pageHtml(PAGE_A));
  g.fbSnapRun_();
  const before = JSON.stringify(g.__app.book.sheets.PICKS.rows);

  const r2 = g.fbSnapRun_();          /* ยิงซ้ำ หน้าเว็บยังเป็นคู่เดิม */
  eq(r2.added.length, 0);
  eq(r2.skipped.length, 2);
  eq(nPicks(g), 2, 'ห้ามงอกแถวใหม่');
  eq(JSON.stringify(g.__app.book.sheets.PICKS.rows), before, 'ภาพนิ่งของเดิมต้องไม่ถูกแตะ');
});

test('เขาเปลี่ยนคู่ = จดแถวใหม่ ของเก่ายังอยู่ (เก็บเป็นประวัติ)', () => {
  const g = fbEnv(bookOf([]), pageHtml(PAGE_A));
  g.fbSnapRun_();
  g.__fetchBody = pageHtml(PAGE_B);
  /* เปลี่ยนของที่ UrlFetchApp คืน โดยไม่ต้องโหลดใหม่ */
  g.UrlFetchApp.fetch = () => fakeResponse(200, pageHtml(PAGE_B));

  const r = g.fbSnapRun_();
  eq(r.added.length, 1, 'เปลี่ยนแค่ช่อง FEATURED');
  eq(r.skipped.length, 1, 'POTD คู่เดิม');
  eq(nPicks(g), 3);

  const rows = g.readObjects_('PICKS');
  ok(rows.some(x => x['ทีมเหย้า'] === 'Arsenal'), 'ของเก่าต้องยังอยู่');
  ok(rows.some(x => x['ทีมเหย้า'] === 'Chelsea'), 'ของใหม่ต้องเข้ามา');
});

test('โดนบล็อก 403 = ไม่เขียนอะไรเลย ของเก่าอยู่ครบ', () => {
  const old = [pickRow({ 'ID':'FB-FEATURED-1', 'ช่อง':'FEATURED', 'ทีมเหย้า':'Arsenal', 'ทีมเยือน':'Leeds' })];
  const g = fbEnv(bookOf(old), 'blocked', 403);
  const r = g.fbSnapRun_();
  eq(r.ok, false);
  eq(r.code, 403);
  eq(r.added.length, 0);
  eq(nPicks(g), 1, 'ของเก่าต้องอยู่ครบ');
  ok(String(r.error || '').length > 0, 'ต้องบอกสาเหตุ');
});

test('หน้าเว็บเขาเปลี่ยนหน้าตา อ่านไม่ออก = ไม่เขียนชีต แต่ต้องรายงานว่าพลาด', () => {
  const old = [pickRow({ 'ID':'FB-FEATURED-1', 'ช่อง':'FEATURED', 'ทีมเหย้า':'Arsenal', 'ทีมเยือน':'Leeds' })];
  const junk = '<html><body>' + 'ไม่มีอะไรที่รู้จักเลย '.repeat(120) + '</body></html>';
  const g = fbEnv(bookOf(old), junk);
  const r = g.fbSnapRun_();
  eq(r.ok, true, 'ดึงหน้าได้ แต่แกะไม่ออก');
  eq(r.added.length, 0);
  eq(r.missed.length, 2, 'ต้องบอกว่าแกะไม่ออกทั้ง 2 ช่อง');
  eq(nPicks(g), 1, 'ห้ามเขียนทับของเก่า');
});

test('เลขสกอร์ 2-1 ต้องไม่หลุดมาเป็นชื่อทีม', () => {
  const g = fbEnv(bookOf([]), '');
  eq(g.fbTeamsByText_('Featured 2 - 1 71%'), null);
  ok(g.fbTeamsByText_('Arsenal - Leeds 2-0') !== null, 'ชื่อทีมจริงต้องยังอ่านออก');
});

test('fbPinned_ คืนแถวล่าสุดของแต่ละช่อง พร้อมบอกว่าดึงเมื่อไหร่', () => {
  const rows = [
    pickRow({ 'ID':'A1', 'ช่อง':'FEATURED', 'ทีมเหย้า':'Arsenal', 'ทีมเยือน':'Leeds',
              'สร้างเมื่อ':'2026-08-24T12:00:00+07:00' }),
    pickRow({ 'ID':'A2', 'ช่อง':'FEATURED', 'ทีมเหย้า':'Chelsea', 'ทีมเยือน':'Everton',
              'สร้างเมื่อ':'2026-08-25T12:00:00+07:00' }),
    pickRow({ 'ID':'B1', 'ช่อง':'POTD', 'ทีมเหย้า':'PSV', 'ทีมเยือน':'Sparta' })
  ];
  const g = fbEnv(bookOf(rows), '');
  const out = g.fbPinned_(rows, { Arsenal: 'อาร์เซนอล' });
  eq(out.length, 2);
  eq(out[0]['ช่อง'], 'FEATURED');
  eq(out[0]['เหย้า'], 'Chelsea', 'ต้องเอาแถวใหม่สุด');
  eq(out[0]['ดึงเมื่อ'], '2026-08-25T12:00:00+07:00');
  eq(out[1]['ช่อง'], 'POTD');
});

test('ยังไม่เคยดึงเลย = pinned ว่าง หน้า 1 ต้องไม่พัง', () => {
  const g = fbEnv(bookOf([]), '');
  eq(g.fbPinned_([], {}).length, 0);
  eq(g.fbPinned_(null, {}).length, 0);
});
