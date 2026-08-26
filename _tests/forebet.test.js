/* forebet.test.js — ตัวดึง Featured / Pick of the day มาแช่ไว้หน้า 1
   ข้อที่ต้องพิสูจน์: ดึงไม่ได้ = ของเก่าในชีตต้องอยู่ครบ ห้ามหายห้ามถูกทับ */

const { loadGas, fakeResponse } = require('./gasEnv');
const fs = require('fs');
const path = require('path');
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
/** หน้าเว็บปลอม — ลอกโครงจริงของ forebet มาจาก _tests/fixtures/forebet-real.html
    ต้องใช้ชื่อ class / microdata ชุดเดียวกับของจริง ไม่งั้นเทสต์เขียวแต่ของจริงพัง
    ของจริงแยกเป็น 2 ที่: กล่องปักหมุดมีแค่ ทีม/ลีก/เวลา/1X2
    ส่วนสกอร์ที่เดากับเปอร์เซ็นต์อยู่ในแถวของคู่เดียวกันในตารางใหญ่ */
function fbFakeRow(m, big) {
  const cols = big
    ? '<div class="fprc"><span>' + m.p[0] + '</span><span>' + m.p[1] + '</span>' +
        '<span class="fpr">' + m.p[2] + '</span></div>' +
      '<span class="scrmobpred ex_sc">' + m.sc.split('-')[0] +
        '<span class="scrmobpreddash">-</span>' + m.sc.split('-')[1] + '</span>' +
      '<div class="ex_sc tabonly">' + m.sc.replace('-', ' - ') + '</div>' +
      '<div class="avg_sc tabonly">2.37</div>' +
      '<div class="bigOnly prmod"><span class="lscrsp" title="odds">' + m.odds + '</span></div>'
    : '';
  return '<div class="rcnt tr_0">' +
    '<div class="stcn"><div class="shortagDiv tghov">' +
      '<img class="flsc" onclick="getstag(this,' + m.id + ",'" + m.country + "','" + m.league +
        "','football/predictions-1x2','xx')" + '">' +
      '<span class="shortTag">' + m.tag + '</span></div>' +
      '<div id="' + m.id + '" class="nofav fav_icon"></div></div>' +
    '<div class="tnms"><div itemscope itemtype="http://schema.org/SportsEvent">' +
      '<meta itemprop="name" content="' + m.home + ' vs ' + m.away + '">' +
      '<a class="tnmscn" itemprop="url" href="/en/football/matches/x-' + m.id + '">' +
      '<span class="homeTeam" itemprop="homeTeam" itemscope><span itemprop="name">' + m.home + '</span></span>' +
      '<span class="awayTeam" itemprop="awayTeam" itemscope><span itemprop="name">' + m.away + '</span></span>' +
      '<time itemprop="startDate" datetime="' + m.iso + 'T18:30:00+00:00">' +
      '<span class="date_bah">' + m.shown + '</span></time></a>' +
      '</div></div>' +
    '<div class="predict"><span class="forepr"><span>' + m.wdl + '</span></span></div>' +
    cols + '</div>';
}
function pageHtml(a) {
  const feat = { id: 1111111, country: 'England', league: a.league1, tag: 'PL',
    home: a.home1, away: a.away1, wdl: '1', p: [a.pct1, 12, 17],
    sc: a.sc1, odds: a.odds1, iso: '2026-08-25', shown: a.date1 + ' 18:30' };
  const potd = { id: 2222222, country: 'Netherlands', league: a.league2, tag: 'Ned1',
    home: a.home2, away: a.away2, wdl: 'X', p: [20, a.pct2, 16],
    sc: a.sc2, odds: a.odds2, iso: '2026-08-25', shown: a.date2 + ' 20:00' };
  /* คั่นให้ห่างเกิน FB_WINDOW จริงๆ — กล่องปักหมุดต้องไม่บังเอิญเห็นแถวตารางใหญ่
     ถ้าไม่คั่น เทสต์จะผ่านทั้งที่ตัวตามรหัสคู่ (fbRowById_) ไม่ได้ทำงานเลย */
  const gap = '<!--' + 'x'.repeat(5000) + '-->';
  return '<html><body><div class="wrap">' +
    '<div class="ftrdmtch"><h3>Featured match</h3>' + fbFakeRow(feat, false) + '</div>' +
    '<div class="ftrdmtch"><h3>Pick of the day</h3>' + fbFakeRow(potd, false) + '</div>' +
    gap +
    '<h1>Featured matches</h1>' +          /* ตารางใหญ่ — คำนี้ห้ามถูกจับเป็นกล่อง */
    '<div class="schema">' + fbFakeRow(feat, true) + fbFakeRow(potd, true) + '</div>' +
    '</div></body></html>';
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
  eq(String(feat['เวลาเตะ']), '01:30', 'เวลาไทย = ที่เขาโชว์ (18:30) บวก 7');

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

test('เลขสกอร์/หัวตาราง ต้องไม่หลุดมาเป็นชื่อทีม', () => {
  const g = fbEnv(bookOf([]), '');
  eq(g.fbTeamOk_('Home team'), false, 'หัวตารางของเขา ไม่ใช่ชื่อทีม');
  eq(g.fbTeamOk_('Away team'), false);
  eq(g.fbTeamOk_('2 - 1'), false, 'ตัวเลขล้วน ไม่ใช่ชื่อทีม');
  ok(g.fbTeamOk_('Arsenal'), 'ชื่อทีมจริงต้องยังผ่าน');
  ok(g.fbTeamOk_('Cúcuta Deportivo'), 'ชื่อที่มีสระเสียงต้องผ่านด้วย');
  /* กล่องที่มีแต่ตัวเลข = ถือว่าไม่ได้ของ ห้ามเดาชื่อทีมเอง */
  eq(g.fbParseOne_('<h3>Featured match</h3><div class="rcnt">2 - 1 71%</div>', 'FEATURED'), null);
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

/* ================= ดึงเองเมื่อของเก่า (ไม่พึ่ง trigger) =================
   ที่มา: ยิง ?p=snap จริงแล้วได้ error "ไม่ได้รับอนุญาตให้เรียกใช้ ScriptApp.getProjectTriggers"
   deployment ตัวนี้ไม่ได้ขอสิทธิ์ script.scriptapp ไว้ และจะไปเพิ่มทีหลังไม่ได้
   (เจ้าของต้องกดอนุญาตใหม่ทั้งชุดจากมือถือ เสี่ยงพังของที่ใช้อยู่)
   ทางแก้: ให้ทางอ่านข้อมูลดึงเองเมื่อภาพนิ่งเก่าเกินกำหนด */

/** env ที่ "ไม่" ทับ PropertiesService — ตัวหน่วง FB_LAST_TRY ถึงจะทำงานจริง
    คืน g.__n มาให้นับว่ายิงเน็ตไปกี่ครั้ง */
function fbEnvP(book, body, code) {
  const app = new FakeSpreadsheetApp(book);
  const box = { n: 0 };
  const g = loadGas(['gas/Config.gs', 'gas/Sheets.gs', 'gas/Forebet.gs', 'gas/Api.gs'], {
    SpreadsheetApp: app,
    Utilities: { formatDate: () => '2026-08-25T18:00:00' },
    UrlFetchApp: { fetch: () => { box.n++; return fakeResponse(code === undefined ? 200 : code, body); } }
  });
  g.PropertiesService.getScriptProperties().setProperty('SHEET_ID', 'S');
  g.__app = app;
  g.__box = box;
  return g;
}
const T = (s) => Date.parse(s);

/* snap ที่สำเร็จต้องรายงานครบ — ของเดิมมีบรรทัดติด trigger ต่อท้ายแล้ว throw กลืนทั้งก้อน
   ตอนนี้ตัดท่อน trigger ทิ้งแล้ว (ไม่ได้ใช้ + ลากสิทธิ์ script.scriptapp มาขอเปล่าๆ)
   เทสต์นี้จึงเหลือหน้าที่เดียว: ยืนยันว่า snap คายของครบและลงชีตจริง */
test('snap สำเร็จ ต้องรายงานของที่ได้ครบและลงชีต', () => {
  const g = fbEnv(bookOf([]), pageHtml(PAGE_A));
  const snap = g.fbSnapRun_();
  eq(snap.ok, true);
  eq(snap.added.length, 2, 'ของที่ดึงมาได้ต้องรายงานครบ');
  eq(nPicks(g), 2);
});

test('ยังไม่เคยดึงเลย = ถือว่าเก่า ต้องไปดูใหม่', () => {
  const g = fbEnv(bookOf([]), '');
  eq(g.fbStale_([], T('2026-08-25T12:00:00+07:00')), true);
  eq(g.fbStale_(null, T('2026-08-25T12:00:00+07:00')), true);
});

test('มีแค่ช่องเดียว = ยังถือว่าเก่า (อีกช่องยังขาด)', () => {
  const g = fbEnv(bookOf([]), '');
  const rows = [pickRow({ 'ช่อง':'FEATURED', 'สร้างเมื่อ':'2026-08-25T11:00:00+07:00' })];
  eq(g.fbStale_(rows, T('2026-08-25T12:00:00+07:00')), true);
});

/* เจ้าของสั่ง "ทุกครั้งที่เปิด ข้อมูลต้องไปลงในชีต" -> ไม่มีคำว่าของยังสดอีกแล้ว
   เพิ่งดึงไปเมื่อกี้ก็ยังต้องถือว่าเก่า ตัวกันยิงรัวไปอยู่ที่ fbAutoSnap_ (10 นาที) แทน */
test('เปิดหน้าทีไร = ถือว่าเก่าเสมอ ต้องไปดึงใหม่ทุกครั้ง', () => {
  const g = fbEnv(bookOf([]), '');
  const rows = [
    pickRow({ 'ช่อง':'FEATURED', 'สร้างเมื่อ':'2026-08-25T11:59:00+07:00' }),
    pickRow({ 'ช่อง':'POTD', 'สร้างเมื่อ':'2026-08-25T11:59:00+07:00' })
  ];
  eq(g.fbStale_(rows, T('2026-08-25T12:00:00+07:00')), true, 'ดึงไปเมื่อนาทีที่แล้วก็ยังต้องดึงใหม่');
});

test('ช่อง สร้างเมื่อ ว่างหรืออ่านไม่ออก = ถือว่าเก่า ไม่ใช่ถือว่าสด', () => {
  const g = fbEnv(bookOf([]), '');
  const rows = [
    pickRow({ 'ช่อง':'FEATURED', 'สร้างเมื่อ':'' }),
    pickRow({ 'ช่อง':'POTD', 'สร้างเมื่อ':'2026-08-25T11:00:00+07:00' })
  ];
  eq(g.fbStale_(rows, T('2026-08-25T12:00:00+07:00')), true);
});

test('มีของอยู่แล้วก็ยังต้องไปดึงใหม่ (เจ้าของสั่งให้ลงชีตทุกครั้งที่เปิด)', () => {
  const g = fbEnvP(bookOf([]), pageHtml(PAGE_A));
  const rows = [
    pickRow({ 'ช่อง':'FEATURED', 'สร้างเมื่อ':'2026-08-25T11:00:00+07:00' }),
    pickRow({ 'ช่อง':'POTD', 'สร้างเมื่อ':'2026-08-25T11:00:00+07:00' })
  ];
  eq(g.fbAutoSnap_(rows, T('2026-08-25T12:00:00+07:00')), true, 'ต้องออกไปดึง');
  ok(g.__box.n > 0, 'ต้องมีการยิงเน็ตจริง');
});

/* แต่กดรัวๆ ต้องไม่ยิงรัวตาม ไม่งั้นหน้าเว็บค้างรอโหลดทุกครั้ง และเสี่ยงโดนบล็อก */
test('กดซ้ำภายใน 10 นาที = ไม่ยิงเน็ตเพิ่ม', () => {
  const g = fbEnvP(bookOf([]), pageHtml(PAGE_A));
  const t0 = T('2026-08-25T12:00:00+07:00');
  g.fbAutoSnap_([], t0);
  const after1 = g.__box.n;
  ok(after1 > 0, 'รอบแรกต้องออกไปดึงจริง');
  eq(g.fbAutoSnap_(g.readObjects_('PICKS'), t0 + 5 * 60000), false, 'ยังไม่ถึงคิว');
  eq(g.__box.n, after1, 'ห้ามยิงซ้ำ');
});

test('ของเก่า + ดึงได้ = จดลงชีต แล้วบอกคนเรียกให้อ่านชีตซ้ำ', () => {
  const g = fbEnvP(bookOf([]), pageHtml(PAGE_A));
  eq(g.fbAutoSnap_([], T('2026-08-25T12:00:00+07:00')), true);
  eq(nPicks(g), 2);
  ok(g.__box.n > 0, 'ต้องมีการยิงเน็ตจริง');
});

test('ของเก่า + โดน 403 = คืน false ไม่เขียนชีต ไม่ throw หน้าเว็บต้องขึ้นได้', () => {
  const old = [pickRow({ 'ช่อง':'FEATURED', 'ทีมเหย้า':'Arsenal', 'ทีมเยือน':'Leeds' })];
  const g = fbEnvP(bookOf(old), 'blocked', 403);
  eq(g.fbAutoSnap_(g.readObjects_('PICKS'), T('2026-08-25T12:00:00+07:00')), false);
  eq(nPicks(g), 1, 'ของเก่าต้องอยู่ครบ');
});

/* รอบที่ "ล้ม" ต้องกลับมาลองใหม่เร็วกว่ารอบที่สำเร็จ
   เหตุที่ล้มส่วนใหญ่เป็นของชั่วคราว (โดนปฏิเสธเป็นพักๆ) ถ้าพักเท่ากับรอบสำเร็จ
   เจ้าของจะเปิดแอปเจอ "ไม่มีคู่" ยาว 10 นาทีเต็ม ทั้งที่เปิดใหม่อีกทีก็ได้แล้ว
   แต่ก็ยังต้องมีคิวกันคนกดรัว ไม่ใช่ยิงใหม่ทุกครั้งที่กด */
test('ดึงพลาด = พักสั้นแล้วลองใหม่ ไม่ใช่เงียบยาวเท่ารอบที่สำเร็จ', () => {
  const g = fbEnvP(bookOf([]), 'blocked', 403);
  const t0 = T('2026-08-25T12:00:00+07:00');
  /* นับเป็น "มียิงเพิ่มหรือเปล่า" — 1 รอบดึงมันลองหลาย URL ไม่ใช่ครั้งเดียว */
  g.fbAutoSnap_([], t0);
  const after1 = g.__box.n;
  ok(after1 > 0, 'รอบแรกต้องออกไปดึงจริง');

  g.fbAutoSnap_([], t0 + 1 * 60000);         /* ผ่านไป 1 นาที */
  eq(g.__box.n, after1, 'กดรัวๆ ห้ามยิงซ้ำ');

  g.fbAutoSnap_([], t0 + 3 * 60000);         /* ผ่านไป 3 นาที */
  ok(g.__box.n > after1, 'พ้นคิวสั้นแล้วต้องกลับไปลองใหม่');
});

test('รอบที่สำเร็จ = พักเต็ม 10 นาที ห้ามกลับไปกวนเขาเร็วกว่านั้น', () => {
  const g = fbEnvP(bookOf([]), pageHtml(PAGE_A));
  const t0 = T('2026-08-25T12:00:00+07:00');
  eq(g.fbAutoSnap_([], t0), true);
  const after1 = g.__box.n;
  /* ส่ง [] ทุกครั้ง = บังคับให้ผ่านด่าน "ของเก่าหรือยัง" มาถึงด่านคิวเสมอ
     จะได้วัดเรื่องคิวอย่างเดียว ไม่ปนกับเรื่องอายุของภาพนิ่ง */
  g.fbAutoSnap_([], t0 + 3 * 60000);
  eq(g.__box.n, after1, 'สำเร็จแล้วห้ามใช้คิวสั้นของรอบที่ล้ม');
  g.fbAutoSnap_([], t0 + 11 * 60000);
  ok(g.__box.n > after1, 'พ้น 10 นาทีแล้วดึงใหม่ได้');
});

test('ทางอ่านข้อมูลดึงเองได้จริง — ของเก่า/ยังไม่มี แล้วคู่ปักหมุดโผล่ในรอบเดียว', () => {
  const g = fbEnvP(bookOf([]), pageHtml(PAGE_A));
  const out = g.payloadAll_(T('2026-08-25T18:00:00+07:00'));
  eq(out.ok, true);
  eq(out.pinned.length, 2, 'ต้องได้คู่ปักหมุดโดยไม่ต้องพึ่ง trigger');
  eq(out.pinned[0]['ช่อง'], 'FEATURED');
  eq(out.pinned[0]['เหย้า'], 'Arsenal');
});

test('forebet ล่ม/บล็อก = payloadAll_ ต้องยังคายของเก่าออกมาได้ตามปกติ', () => {
  const old = [
    pickRow({ 'ID':'FB-FEATURED-1', 'ช่อง':'FEATURED', 'ทีมเหย้า':'Arsenal', 'ทีมเยือน':'Leeds' }),
    pickRow({ 'ID':'FB-POTD-1', 'ช่อง':'POTD', 'ทีมเหย้า':'PSV', 'ทีมเยือน':'Sparta' })
  ];
  const g = fbEnvP(bookOf(old), 'blocked', 403);
  const out = g.payloadAll_(T('2026-08-25T18:00:00+07:00'));
  eq(out.ok, true);
  eq(out.pinned.length, 2, 'ของเก่าต้องยังขึ้นหน้า 1');
  eq(nPicks(g), 2, 'ห้ามเขียนอะไรเพิ่ม');
});

/* ---------- ของจริง: หน้าเว็บที่เจ้าของก๊อปมาให้ ---------- */
const REAL = require('fs').readFileSync(
  require('path').join(__dirname, 'fixtures', 'forebet-real.html'), 'utf8');

test('หน้าจริงของ forebet: อ่านออกครบทั้ง 2 กล่อง', () => {
  const g = fbEnv(bookOf([]), REAL);

  const f = g.fbParseOne_(REAL, 'FEATURED');
  ok(f, 'กล่อง Featured match ต้องอ่านออก');
  eq(f['ทีมเหย้า'], 'Fuglebakken KFUM');
  eq(f['ทีมเยือน'], 'Vendsyssel FF');
  eq(f['อ่านทีมจาก'], 'micro', 'ต้องได้จาก microdata ชั้นใน ไม่ใช่ตัวสำรอง');
  eq(f['ลีก'], 'DBUs Landspokal');
  eq(f['วันที่'], '2026-08-26', 'หน้าจริงโชว์ 25/08 18:30 -> ไทย 26/08 01:30');
  eq(f['เดาผล'], '2');
  eq(f['เดาสกอร์'], '0-1', 'สกอร์อยู่ในแถวตารางใหญ่ ต้องตามรหัสคู่ไปเก็บมา');
  eq(f['เปอร์เซ็นต์'], 60, 'ต้องหยิบตัวที่ตรงกับผลที่เขาเดา (ช่อง 2)');
  eq(f['รหัสคู่'], '2518832');
  eq(f['เวลาที่เขาโชว์'], '25/08/2026 18:30');
  eq(f['เวลาเตะ'], '01:30', 'เวลาไทย +7 จากที่หน้าจริงโชว์');

  const p = g.fbParseOne_(REAL, 'POTD');
  ok(p, 'กล่อง Pick of the day ต้องอ่านออก');
  eq(p['ทีมเหย้า'], 'Cúcuta Deportivo');
  eq(p['ทีมเยือน'], 'Alianza Petrolera');
  eq(p['เดาผล'], 'X');
  eq(p['เดาสกอร์'], '1-1');
  eq(p['เปอร์เซ็นต์'], 42, 'ผลเป็น X ต้องหยิบตัวกลาง');
  eq(p['วันที่'], '2026-08-26');
  eq(p['รหัสคู่'], '2528659');
  eq(p['ลีก'], 'Primera A', 'กล่องนี้เขาส่งชื่อลีกมาเป็นค่าว่าง ต้องตามรหัสคู่ไปหยิบจากตารางใหญ่');
});

test('ชื่อลีก: กล่องส่งค่าว่างมา ห้ามตกไปใช้ตัวย่อทั้งที่ตารางใหญ่มีชื่อเต็ม', () => {
  const g = fbEnv(bookOf([]), REAL);
  const w = g.fbWindow_(REAL, 'POTD');
  const id = g.fbMatchId_(w.raw);
  const row = g.fbRowById_(REAL, id);

  eq(g.fbLeague_(w.raw), 'Co1', 'ดูแต่ในกล่อง = ได้แค่ตัวย่อ (นี่คืออาการที่เจ้าของเห็น)');
  eq(g.fbLeague_(w.raw, row, id), 'Primera A', 'ตามรหัสคู่ไปแถวใหญ่ต้องได้ชื่อเต็ม');

  eq(g.fbLeagueFull_(row, id), 'Primera A', 'ยึดรหัสคู่ที่ขอ');
  eq(g.fbLeagueFull_(row, '2418131'), 'Brasileiro Serie A',
     'แถวเดียวกันมี getstag ของคู่อื่นปนอยู่ ต้องหยิบให้ถูกคู่');
  eq(g.fbLeagueFull_(w.raw, id), '', 'ค่าว่างคือค่าว่าง ห้ามเดา');
  eq(g.fbLeagueFull_('', id), '');
});

test('หน้าจริง: จดลงชีตได้ครบ 2 แถว', () => {
  const g = fbEnv(bookOf([]), REAL);
  const r = g.fbSnapRun_();
  eq(r.ok, true);
  eq(r.missed.length, 0);
  eq(nPicks(g), 2);
  const rows = g.readObjects_('PICKS');
  ok(rows.some(x => x['ทีมเหย้า'] === 'Fuglebakken KFUM'), 'คู่ Featured ต้องลงชีต');
  ok(rows.some(x => x['ทีมเหย้า'] === 'Cúcuta Deportivo'), 'คู่ Pick of the day ต้องลงชีต');
});

test('ราคาแบบอเมริกัน (-1429 / +210) = ไม่กรอก ห้ามแปลงเอง (กฎข้อ 6)', () => {
  const g = fbEnv(bookOf([]), REAL);
  eq(g.fbParseOne_(REAL, 'FEATURED')['ราคา'], 0, 'หน้าจริงหน้านี้เป็นราคาอเมริกัน');
  eq(g.fbOdds_('<div class="prmod"><span class="lscrsp">-1429</span></div>'), 0);
  eq(g.fbOdds_('<div class="prmod"><span class="lscrsp">+210</span></div>'), 0);
  eq(g.fbOdds_('<div class="prmod"><span class="lscrsp">1.42</span></div>'), 1.42,
    'ถ้าเขาให้เป็นทศนิยม ต้องยังอ่านได้ตามเดิม');
});

test('เลขค่าเฉลี่ยประตูในแถวเดียวกัน ต้องไม่หลุดมาเป็นราคา', () => {
  const g = fbEnv(bookOf([]), '');
  const row = '<div class="rcnt"><div class="avg_sc tabonly">2.37</div>' +
              '<div class="bigOnly prmod"><span class="lscrsp">-1429</span></div></div>';
  eq(g.fbOdds_(row), 0, '2.37 คือค่าเฉลี่ยประตู ไม่ใช่ราคา');
});

test('หัวข้อ "Featured matches" ของตารางใหญ่ ต้องไม่ถูกจับเป็นกล่องปักหมุด', () => {
  const g = fbEnv(bookOf([]), '');
  const html = '<h1>Featured matches</h1><div class="rcnt">' +
    '<span itemprop="homeTeam" itemscope><span itemprop="name">Home team</span></span>' +
    '<span itemprop="awayTeam" itemscope><span itemprop="name">Away team</span></span></div>';
  eq(g.fbWindow_(html, 'FEATURED').found, false, 'พหูพจน์ = คนละหัวข้อ');
  eq(g.fbParseOne_(html, 'FEATURED'), null);
});

/* ---------- ทางเน็ต: forebet ปิดประตูใส่ IP เรา (403) ต้องอ้อมได้เอง ---------- */

/** env ที่คุมได้ทั้ง "ใครขออะไร" และ "Script Property มีอะไร" */
function fbNet(book, fetchFn, props) {
  const app = new FakeSpreadsheetApp(book);
  const calls = [];
  const g = loadGas(['gas/Config.gs', 'gas/Sheets.gs', 'gas/Forebet.gs', 'gas/Api.gs'], {
    SpreadsheetApp: app,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: k => Object.assign({ SHEET_ID: 'S' }, props || {})[k] || null
      })
    },
    Utilities: { formatDate: () => '2026-08-25T18:00:00' },
    UrlFetchApp: {
      fetch: (url, opt) => {
        calls.push({ url, opt });
        return fetchFn(url, opt);
      }
    }
  });
  g.__app = app; g.__calls = calls;
  return g;
}

const BLOCKED = '<html><head><title>Attention Required! | Cloudflare</title></head><body>' +
                'Sorry, you have been blocked. '.repeat(60) + '</body></html>';

test('ยิงตรงโดนกั้น 403 = ต้องอ้อม Jina เองแล้วได้ของครบ', () => {
  const good = pageHtml(PAGE_A);
  const g = fbNet(bookOf([]), url =>
    url.indexOf('https://r.jina.ai/') === 0 ? fakeResponse(200, good) : fakeResponse(403, BLOCKED));
  const r = g.fbSnapRun_();
  eq(r.ok, true, 'อ้อมแล้วต้องสำเร็จ ไม่ใช่ยอมแพ้ตั้งแต่ 403');
  eq(r.added.length, 2, 'ต้องได้ทั้ง 2 กล่อง');
  eq(r.via, 'ผ่าน https://r.jina.ai/', 'รายงานต้องบอกว่าไปทางไหน จะได้ไล่ปัญหาถูก');
  eq(nPicks(g), 2);
});

test('ตอนอ้อมต้องขอ html ด้วย ไม่งั้น Jina คืน markdown = ตัวอ่านตาบอด', () => {
  const good = pageHtml(PAGE_A);
  const g = fbNet(bookOf([]), url =>
    url.indexOf('https://r.jina.ai/') === 0 ? fakeResponse(200, good) : fakeResponse(403, BLOCKED));
  g.fbSnapRun_();
  const viaCall = g.__calls.filter(c => c.url.indexOf('https://r.jina.ai/') === 0)[0];
  eq(!!viaCall, true, 'ต้องมีการยิงผ่าน Jina จริง');
  eq(String(viaCall.opt.headers['X-Return-Format']), 'html');
  eq(viaCall.url, 'https://r.jina.ai/https://www.forebet.com/en', 'ต่อ url ตรงๆ ห้ามใส่ช่องว่าง/encode ทับ');
});

/* กลับทางจากของเดิม: วัดจริงแล้ว IP ของ Google โดน Cloudflare ปิดประตู 403 "ทุกครั้ง"
   ยิงตรงก่อนจึงไม่ใช่ทางลัด แต่เป็นการทิ้งเวลาฟรี 2 นัดต่อรอบ ซึ่งไปเบียดเวลาของหน้าคู่ที่ยังต้องเปิดต่อ
   อ้อมได้แล้วต้องจบ ห้ามยิงตรงตามหลังให้เสียเวลาอีก */
test('อ้อมได้แล้ว = ห้ามยิงตรงตามหลังให้เปลืองเวลา', () => {
  const good = pageHtml(PAGE_A);
  const g = fbNet(bookOf([]), () => fakeResponse(200, good));
  const r = g.fbSnapRun_();
  eq(r.ok, true);
  eq(r.via, 'ผ่าน https://r.jina.ai/');
  eq(g.__calls.filter(c => c.url.indexOf('r.jina.ai') < 0).length, 0, 'ห้ามมียิงตรงเลยสักครั้ง');
});

test('หน้าที่ได้มาไม่ใช่หน้า forebet (โดนกั้นแต่ตอบ 200) = ต้องไม่หยุดแค่นั้น ไปลองทางอ้อมต่อ', () => {
  const good = pageHtml(PAGE_A);
  const g = fbNet(bookOf([]), url =>
    url.indexOf('https://r.jina.ai/') === 0 ? fakeResponse(200, good) : fakeResponse(200, BLOCKED));
  const r = g.fbSnapRun_();
  eq(r.ok, true);
  eq(r.added.length, 2);
  eq(r.via, 'ผ่าน https://r.jina.ai/');
});

test('เจ้าของสั่งปิดทางอ้อม (FB_PROXY = "-") = ยิงตรงอย่างเดียว ไม่แอบอ้อม', () => {
  const g = fbNet(bookOf([]), () => fakeResponse(403, BLOCKED), { FB_PROXY: '-' });
  const r = g.fbSnapRun_();
  eq(r.ok, false);
  eq(g.__calls.filter(c => c.url.indexOf('r.jina.ai') >= 0).length, 0);
  eq(nPicks(g), 0, 'ดึงไม่ได้ = ห้ามแตะชีต');
});

test('ทุกทางพัง = ของเก่าในชีตต้องอยู่ครบ ไม่ถูกลบไม่ถูกทับ', () => {
  const old = pickRow({ 'ID': 'FB-FEATURED-1', 'ช่อง': 'FEATURED', 'ทีมเหย้า': 'Arsenal', 'ทีมเยือน': 'Leeds' });
  const g = fbNet(bookOf([old]), () => fakeResponse(403, BLOCKED));
  const r = g.fbSnapRun_();
  eq(r.ok, false);
  eq(nPicks(g), 1);
  eq(g.__app.book.sheets.PICKS.rows[1][HEAD_PICKS.indexOf('ทีมเหย้า')], 'Arsenal');
});

/* ---------- เวลาไทย ---------- */

test('เวลาไทย: วัน/เดือน สลับกันได้ตามคนขอ จึงต้องยึดวันที่จาก ISO ห้ามแกะจากข้อความ', () => {
  const g = fbNet(bookOf([]), () => fakeResponse(200, pageHtml(PAGE_A)));
  /* เขาโชว์แบบเดือน/วัน + AM/PM (แบบที่ Jina เห็น) — เดือน 08 วัน 26 */
  const a = g.fbWhenLocal_('2026-08-26', '08/26/2026 3:30 PM');
  eq(a.date, '2026-08-26'); eq(a.time, '22:30');
  /* เขาโชว์แบบวัน/เดือน 24 ชม. (แบบที่เบราว์เซอร์เจ้าของเห็น) — ตัวเลขนำหน้าคือ 25 ไม่ใช่เดือน */
  const b = g.fbWhenLocal_('2026-08-25', '25/08/2026 18:30');
  eq(b.date, '2026-08-26', 'บวก 7 แล้วข้ามเที่ยงคืน'); eq(b.time, '01:30');
});

test('เวลาไทย: อ่านเวลาไม่ออก = ปล่อยว่าง ห้ามเดา', () => {
  const g = fbNet(bookOf([]), () => fakeResponse(200, pageHtml(PAGE_A)));
  eq(g.fbWhenLocal_('2026-08-25', 'TBD'), null);
  eq(g.fbWhenLocal_('', '25/08/2026 18:30'), null, 'ไม่มีวันที่ ISO = ไม่คำนวณ');
  eq(g.fbWhenLocal_('2026-08-25', '25/08/2026 99:99'), null);
});

test('เวลาไทย: ปรับตัวเลขได้จาก FB_TZ_SHIFT และ "" ต้องไม่กลายเป็นบวก 0', () => {
  const g = fbNet(bookOf([]), () => fakeResponse(200, pageHtml(PAGE_A)));
  eq(g.fbWhenLocal_('2026-08-25', '18:30', 0).time, '18:30');
  eq(g.fbWhenLocal_('2026-08-25', '18:30', '').time, '01:30', 'ค่าว่าง = ใช้ 7 ตามเดิม');
  eq(g.fbWhenLocal_('2026-08-25', '18:30', null).time, '01:30');
});

/* ---------- ด่านกันลงซ้ำ: "ห้ามลงชีตคู่ที่ซ้ำเด็ดขาด · ตรวจก่อนค่อยลง" ---------- */

test('ชีตคืนวันที่มาเป็น Date ไม่ใช่ข้อความ — ต้องแปลงให้ตรงกันได้', () => {
  const g = fbEnv(bookOf([]), '');
  eq(g.fbYmd_(new Date(2026, 7, 26, 0, 0, 0)), '2026-08-26', 'Date -> YYYY-MM-DD');
  eq(g.fbYmd_('2026-08-26'), '2026-08-26');
  eq(g.fbYmd_(''), '');
  eq(g.fbHm_(new Date(2026, 7, 26, 22, 30, 0)), '22:30', 'Date -> HH:MM');
  eq(g.fbHm_('4:00'), '04:00', 'เติม 0 หน้าให้ด้วย');
});

test('คู่เดิมที่ยังไม่เตะ = ห้ามลงซ้ำ ต่อให้ชีตเก็บวันที่ไว้เป็น Date', () => {
  const g = fbEnv(bookOf([]), '');
  const rows = [{ 'ช่อง':'FEATURED', 'ทีมเหย้า':'Admira Praha', 'ทีมเยือน':'Taborsko',
                  'วันที่': new Date(2026, 7, 26), 'เวลาเตะ': new Date(2026, 7, 26, 22, 30) }];
  const snap = { 'ช่อง':'FEATURED', 'ทีมเหย้า':'Admira Praha', 'ทีมเยือน':'Taborsko',
                 'วันที่':'2026-08-26', 'เวลาเตะ':'22:30' };
  eq(g.fbExists_(rows, snap, T('2026-08-26T12:00:00+07:00')), true, 'คู่เดิม = ซ้ำ');
});

test('คู่เดียวกันโผล่คนละช่อง ก็ยังนับว่าซ้ำ', () => {
  const g = fbEnv(bookOf([]), '');
  const rows = [{ 'ช่อง':'FEATURED', 'ทีมเหย้า':'Admira Praha', 'ทีมเยือน':'Taborsko',
                  'วันที่':'2026-08-26', 'เวลาเตะ':'22:30' }];
  const snap = { 'ช่อง':'POTD', 'ทีมเหย้า':'admira praha ', 'ทีมเยือน':'Taborsko',
                 'วันที่':'2026-08-26', 'เวลาเตะ':'22:30' };
  eq(g.fbExists_(rows, snap, T('2026-08-26T12:00:00+07:00')), true);
});

test('หน้าเว็บโชว์วันสลับ วัน/เดือน คลาดไป 1 วัน ก็ยังต้องจับได้ว่าซ้ำ', () => {
  const g = fbEnv(bookOf([]), '');
  const rows = [{ 'ช่อง':'FEATURED', 'ทีมเหย้า':'Admira Praha', 'ทีมเยือน':'Taborsko',
                  'วันที่':'2026-08-26', 'เวลาเตะ':'22:30' }];
  const snap = { 'ช่อง':'FEATURED', 'ทีมเหย้า':'Admira Praha', 'ทีมเยือน':'Taborsko',
                 'วันที่':'2026-08-27', 'เวลาเตะ':'22:30' };
  eq(g.fbExists_(rows, snap, T('2026-08-26T12:00:00+07:00')), true, 'ของเดิมยังไม่เตะ = ตัวเดียวกัน');
});

test('คู่ที่เตะจบไปนานแล้ว เจอกันใหม่รอบหน้า = ลงได้ ไม่ถูกบล็อกทิ้ง', () => {
  const g = fbEnv(bookOf([]), '');
  const rows = [{ 'ช่อง':'FEATURED', 'ทีมเหย้า':'Admira Praha', 'ทีมเยือน':'Taborsko',
                  'วันที่':'2026-08-26', 'เวลาเตะ':'22:30' }];
  const snap = { 'ช่อง':'FEATURED', 'ทีมเหย้า':'Admira Praha', 'ทีมเยือน':'Taborsko',
                 'วันที่':'2026-09-30', 'เวลาเตะ':'22:30' };
  eq(g.fbExists_(rows, snap, T('2026-09-29T12:00:00+07:00')), false);
});

test('อ่านชื่อทีมไม่ออก = ถือว่าซ้ำไว้ก่อน ดีกว่าลงขยะ', () => {
  const g = fbEnv(bookOf([]), '');
  eq(g.fbExists_([], { 'ทีมเหย้า':'', 'ทีมเยือน':'Taborsko' }, T('2026-08-26T12:00:00+07:00')), true);
});

test('หน้าเว็บเอาเฉพาะคู่ที่ยังไม่ถึงเวลาเตะ (ชีตยังเก็บของเก่าครบ)', () => {
  const g = fbEnv(bookOf([]), '');
  const rows = [
    { 'ทีมเหย้า':'A', 'ทีมเยือน':'B', 'วันที่':'2026-08-26', 'เวลาเตะ':'22:30' },
    { 'ทีมเหย้า':'C', 'ทีมเยือน':'D', 'วันที่':'2026-08-25', 'เวลาเตะ':'22:30' },
    { 'ทีมเหย้า':'E', 'ทีมเยือน':'F', 'วันที่':'', 'เวลาเตะ':'' }
  ];
  const live = g.fbUpcoming_(rows, T('2026-08-26T12:00:00+07:00'));
  eq(live.length, 2, 'ของเมื่อวานต้องหลุดออก · อ่านเวลาไม่ออกให้เก็บไว้');
  eq(live[0]['ทีมเหย้า'], 'A');
  eq(live[1]['ทีมเหย้า'], 'E');
});


/* ================= 3 ตลาดจากหน้าของคู่เอง (Over / BTTS / HT) =================
   ไฟล์ตัวอย่างตัดมาจากหน้าจริง 2 หน้าที่เจ้าของยืนยันแล้ว ห้ามแก้ด้วยมือ
   ค่าที่ควรได้วัดมาจากหน้าจริงทั้งหมด:
     Admira (2526629): เขาเดา Over -> เรท Over = -208 · เขาเดา No -> Yes = -152 · HT 2 / 12/17/71 / -105
     Boyaca (2476034): เขาเดา Under -> เรท Over = +155 · เขาเดา No -> Yes = +100 · HT X / 30/38/32 / -108
   คู่ Boyaca สำคัญ เพราะเป็นเคส "เขาเดาคนละฝั่งกับที่เราอยากได้" ทั้ง 2 ตลาด */
const MATCH_HTML = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'forebet-match.html'), 'utf8');

function mktEnv() { return fbEnv(bookOf([]), ''); }

test('เรท Over — เขาเดา Over อยู่แล้ว เอาเลขที่โชว์', () => {
  eq(mktEnv().fbSideOdds_(mktEnv().fbMarket_(MATCH_HTML, 2526629, 'uo'), 'Over'), '-208');
});

test('เรท Over — เขาเดา Under ต้องพลิกไปหยิบอีกฝั่งใน haodd ไม่ใช่เลขที่โชว์', () => {
  const g = mktEnv();
  const m = g.fbMarket_(MATCH_HTML, 2476034, 'uo');
  eq(m.pred, 'Under');
  eq(m.odds, '-227', 'เลขที่โชว์คือของฝั่งที่เขาเดา');
  eq(g.fbSideOdds_(m, 'Over'), '+155', 'ของเราคือฝั่งที่เหลือ');
});

test('เรท BTTS เอาแต่ฝั่ง YES — ทั้ง 2 หน้าเขาเดา No จึงต้องพลิกทั้งคู่', () => {
  const g = mktEnv();
  eq(g.fbSideOdds_(g.fbMarket_(MATCH_HTML, 2526629, 'gg'), 'Yes'), '-152');
  eq(g.fbSideOdds_(g.fbMarket_(MATCH_HTML, 2476034, 'gg'), 'Yes'), '+100');
});

test('HT เอาทุกค่า — ผลที่เดา + เปอร์เซ็นต์ 1/X/2 + เรท', () => {
  const g = mktEnv();
  const a = g.fbHtOut_(g.fbMarket_(MATCH_HTML, 2526629, 'ht1'));
  eq(a.pred, '2'); eq(a.pct, '12/17/71'); eq(a.odds, '-105');
  const c = g.fbHtOut_(g.fbMarket_(MATCH_HTML, 2476034, 'ht1'));
  eq(c.pred, 'X'); eq(c.pct, '30/38/32'); eq(c.odds, '-108');
});

test('ไม่เจอตลาดนั้นในหน้า = คืนว่าง ไม่ throw ไม่เดามั่ว', () => {
  const g = mktEnv();
  eq(g.fbMarket_(MATCH_HTML, 2526629, 'htft'), null, 'ตลาดที่ไม่มีจริง');
  eq(g.fbMarket_(MATCH_HTML, 9999999, 'uo'), null, 'คนละคู่');
  eq(g.fbSideOdds_(null, 'Over'), '');
  const h = g.fbHtOut_(null);
  eq(h.pred + '|' + h.pct + '|' + h.odds, '||');
});

test('อ่านคำเดาไม่ออก = คืนว่าง ดีกว่าหยิบผิดฝั่ง (กฎข้อ 6)', () => {
  const g = mktEnv();
  eq(g.fbSideOdds_({ pred: '', odds: '-208', alt: ['+150','-208'] }, 'Over'), '');
  eq(g.fbSideOdds_({ pred: 'Under', odds: '-227', alt: [] }, 'Over'), '',
     'ไม่มีอีกฝั่งให้เทียบ ก็ห้ามเดา');
});

test('fbFillMarkets_ เติมครบ 5 ช่อง ตามชื่อหัวตารางเป๊ะๆ', () => {
  const g = mktEnv();
  const snap = { 'รหัสคู่': 2476034 };
  g.fbFillMarkets_(snap, MATCH_HTML);
  eq(snap['เรท Over'], '+155');
  eq(snap['เรท BTTS YES'], '+100');
  eq(snap['HT เดาผล'], 'X');
  eq(snap['HT %'], '30/38/32');
  eq(snap['HT เรท'], '-108');
});

test('เปอร์เซ็นต์ HT ต้องไม่ติดกันเป็นก้อนเดียว (12 17 71 ไม่ใช่ 121771)', () => {
  const g = mktEnv();
  const m = g.fbMarket_(MATCH_HTML, 2526629, 'ht1');
  eq(m.probs.slice(0, 3).join(','), '12,17,71');
});


/* ========= ตลาดชุดใหม่ที่เจ้าของสั่ง: 1X2 ครบ 3 ตัว · Over% · BTTS% · DB · HT/FT =========
   ไฟล์ตัวอย่างตัดมาจากหน้าจริงของคู่ 2504066 (Duisburg U19 - Borussia Dortmund U19)
   ค่าที่ควรได้วัดจากหน้าจริงทั้งชุด ห้ามแก้ตัวเลขให้เข้ากับโค้ด:
     ตารางใหญ่ 23/17/60 เดา 2 สกอร์ 1-3 · uo 23/77 เดา Over · gg 18/82 เดา Yes
     ht1 4/10/85 เดา 2 · dbc 83% เดา "21" (เขาเขียนติดกันแบบนี้จริง) · ht 51% เดา 2/2
   หน้านี้ไม่มีเรทจากเจ้ามือเลย (โชว์ "-") จึงเป็นเคสพิสูจน์ว่า "ไม่มีเรทก็ต้องได้เปอร์เซ็นต์" */
const MATCH2_HTML = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'forebet-match2.html'), 'utf8');

test('1X2 เอาครบ 3 ตัว 1/X/2 ไม่ใช่ตัวเดียว', () => {
  const g = mktEnv();
  eq(g.fbPct3_(g.fbRowById_(MATCH2_HTML, 2504066)), '23/17/60');
});

test('1X2 อ่านได้ไม่ครบ 3 ตัว = ปล่อยว่างทั้งช่อง ห้ามโชว์ครึ่งๆ', () => {
  const g = mktEnv();
  eq(g.fbPct3_('<div class="fprc"><span class="fpr">42</span></div>'), '');
  eq(g.fbPct3_(''), '');
  eq(g.fbPct3_(null), '');
});

test('Over% / BTTS% เอาฝั่งบวกเสมอ ไม่ว่าเขาจะเดาฝั่งไหน', () => {
  const g = mktEnv();
  eq(g.fbSidePct_(g.fbMarket_(MATCH2_HTML, 2504066, 'uo'), 1), '77', 'Over');
  eq(g.fbSidePct_(g.fbMarket_(MATCH2_HTML, 2504066, 'gg'), 1), '82', 'Yes');
  /* เคสเขาเดาคนละฝั่ง (คู่นี้เดา Under 71/29 และเดา No 68/32)
     เปอร์เซ็นต์ที่เอาขึ้นการ์ดต้องเป็นฝั่งบวกเสมอ = 29 กับ 32 ไม่ใช่ 71/68 ของฝั่งที่เขาเดา */
  eq(g.fbSidePct_(g.fbMarket_(MATCH_HTML, 2476034, 'uo'), 1), '29');
  eq(g.fbSidePct_(g.fbMarket_(MATCH_HTML, 2476034, 'gg'), 1), '32');
});

test('Over% / BTTS% ได้ไม่ครบ 2 ฝั่ง = ไม่รู้ว่าตัวไหนของใคร ปล่อยว่าง', () => {
  const g = mktEnv();
  eq(g.fbSidePct_({ probs: ['77'] }, 1), '');
  eq(g.fbSidePct_({ probs: ['1','2','3'] }, 1), '');
  eq(g.fbSidePct_(null, 1), '');
});

test('ดับเบิลชานซ์ — จดคำเดาตามที่เห็น ห้ามแปลงเป็น 12/2X เอง', () => {
  const g = mktEnv();
  const db = g.fbDbOut_(g.fbMarket_(MATCH2_HTML, 2504066, 'dbc'));
  eq(db.pct, '83');
  eq(db.pred, '21', 'หน้าจริงเขียนติดกันแบบนี้ — กฎข้อ 6 ห้ามเดาแทนเขา');
  const none = g.fbDbOut_(null);
  eq(none.pct + '|' + none.pred, '|');
});

test('HT/FT — ต้องได้คำเดา 2 ตัว ครึ่งแรกกับเต็มเวลา ไม่ใช่ตัวท้ายตัวเดียว', () => {
  const g = mktEnv();
  const hf = g.fbHtFt_(MATCH2_HTML, 2504066);
  eq(hf.pct, '51');
  eq(hf.ht, '2', 'ครึ่งแรกอยู่ในกล่อง prht — fbMarket_ ปกติจะข้ามไปหยิบตัวท้าย');
  eq(hf.ft, '2');
});

test('HT/FT ไม่มีในหน้า = ว่างทั้งชุด ไม่ throw', () => {
  const g = mktEnv();
  const hf = g.fbHtFt_(MATCH_HTML, 2476034);
  eq(hf.pct + '|' + hf.ht + '|' + hf.ft, '||');
});

test('fbFillMarkets_ เติมครบ 12 ช่องจากหน้าจริง (หน้านี้ไม่มีเรทเลย ก็ยังต้องได้เปอร์เซ็นต์)', () => {
  const g = mktEnv();
  const snap = { 'รหัสคู่': 2504066 };
  g.fbFillMarkets_(snap, MATCH2_HTML);
  eq(snap['Over %'], '77');
  eq(snap['BTTS YES %'], '82');
  eq(snap['HT เดาผล'], '2');
  eq(snap['HT %'], '4/10/85');
  eq(snap['DB %'], '83');
  eq(snap['DB เดาผล'], '21');
  eq(snap['HT/FT %'], '51');
  eq(snap['HT/FT เดาผล'], '2/2');
});

test('หน้าที่ไม่มี DB/HTFT = ช่องใหม่ว่าง แต่ของเดิม 5 ช่องต้องไม่พัง', () => {
  const g = mktEnv();
  const snap = { 'รหัสคู่': 2476034 };
  g.fbFillMarkets_(snap, MATCH_HTML);
  eq(snap['เรท Over'], '+155');
  eq(snap['HT %'], '30/38/32');
  eq(snap['DB %'], '');
  eq(snap['DB เดาผล'], '');
  eq(snap['HT/FT เดาผล'], '');
});

/* ---------- กล่องดำ: รอบดึงล่าสุดต้องทิ้งร่องรอยไว้ ---------- */
/* ทำไมต้องมี: เจ้าของเจอ "ไม่มีคู่ของรอบนี้" แล้วไล่ต่อไม่ได้เลย เพราะรายงานของ fbSnapRun_
   ถูกคายทิ้งทุกครั้ง ต้องมีที่จดว่าล้มตรงไหน ไม่งั้นแก้บั๊กด้วยการเดาอย่างเดียว */
test('ดึงพลาด = ต้องจดกล่องดำไว้ พร้อมรหัสกับสาเหตุ', () => {
  const g = fbEnvP(bookOf([]), 'blocked', 403);
  g.fbSnapRun_();
  const rep = g.fbLastReport_();
  ok(rep, 'ต้องมีกล่องดำ');
  eq(rep.ok, false);
  eq(rep.code, 403);
  eq(rep.added, 0);
  ok(String(rep.error).length > 0, 'ต้องบอกสาเหตุ ไม่ใช่เงียบ');
});

test('ดึงสำเร็จ = กล่องดำต้องบอกว่าได้กี่คู่ ไปทางไหน', () => {
  const g = fbEnvP(bookOf([]), pageHtml(PAGE_A));
  g.fbSnapRun_();
  const rep = g.fbLastReport_();
  eq(rep.ok, true);
  eq(rep.added, 2);
  ok(rep.len > 1000);
  ok(String(rep.via).length > 0);
});

test('กล่องดำห้ามมีชื่อคู่หรือของในชีตติดไปด้วย (มันเปิดดูได้โดยไม่ต้องใช้กุญแจ)', () => {
  const g = fbEnvP(bookOf([]), pageHtml(PAGE_A));
  g.fbSnapRun_();
  const raw = g.PropertiesService.getScriptProperties().getProperty('FB_LAST_REPORT');
  ok(raw.indexOf('Arsenal') < 0, 'ห้ามมีชื่อทีม');
  ok(raw.indexOf('FB-') < 0, 'ห้ามมีรหัสแถวในชีต');
});

test('คู่ซ้ำทั้ง 2 ช่อง = กล่องดำต้องบอกว่า "ข้าม" ไม่ใช่บอกว่าพัง', () => {
  const g = fbEnvP(bookOf([]), pageHtml(PAGE_A));
  g.fbSnapRun_();                 /* รอบแรกลงของ */
  g.fbSnapRun_();                 /* รอบสองเจอของเดิม */
  const rep = g.fbLastReport_();
  eq(rep.ok, true);
  eq(rep.added, 0);
  ok(rep.skipped.indexOf('FEATURED') >= 0 && rep.skipped.indexOf('POTD') >= 0);
});

/* ---------- บัตรผ่านของทางอ้อม ---------- */
/* ทางอ้อมแบบไม่มีบัตรจำกัดจำนวนครั้ง "ต่อ IP" และ IP ของ Google ใช้ร่วมกันทั้งโลก
   วันไหนโดนปฏิเสธเป็นพักๆ จะได้มีทางแก้โดยไม่ต้องแก้โค้ด — ใส่บัตรที่ Script Property */
test('มี JINA_KEY = แนบบัตรไปด้วย', () => {
  const good = pageHtml(PAGE_A);
  const g = fbNet(bookOf([]), () => fakeResponse(200, good), { JINA_KEY: 'jk-test' });
  g.fbSnapRun_();
  const c = g.__calls.filter(x => x.url.indexOf('https://r.jina.ai/') === 0)[0];
  eq(String(c.opt.headers['Authorization']), 'Bearer jk-test');
});

test('ไม่มี JINA_KEY = ห้ามแนบหัวบัตรเปล่าๆ ไป', () => {
  const good = pageHtml(PAGE_A);
  const g = fbNet(bookOf([]), () => fakeResponse(200, good));
  g.fbSnapRun_();
  const c = g.__calls.filter(x => x.url.indexOf('https://r.jina.ai/') === 0)[0];
  eq(c.opt.headers['Authorization'], undefined);
});

/* ---------- ทางไหนตอบอะไร ต้องจดครบทุกทาง ----------
   ของเดิมจดแต่ทางสุดท้าย รายงานเลยชี้ "ยิงตรง" ทุกครั้ง หาต้นเหตุจริงไม่เจอ
   ต้องใช้กล่องคุณสมบัติแบบเขียนได้ (ของ fbNet เขียนไม่ได้ กล่องดำจะหาย) */
function fbEnvF(book, fetchFn) {
  const app = new FakeSpreadsheetApp(book);
  const g = loadGas(['gas/Config.gs', 'gas/Sheets.gs', 'gas/Forebet.gs', 'gas/Api.gs'], {
    SpreadsheetApp: app,
    Utilities: { formatDate: () => '2026-08-25T18:00:00' },
    UrlFetchApp: { fetch: (url, opt) => fetchFn(url, opt) }
  });
  g.PropertiesService.getScriptProperties().setProperty('SHEET_ID', 'S');
  g.__app = app;
  return g;
}

test('รายงานต้องบอกว่าแต่ละทางตอบอะไร ไม่ใช่แค่ทางสุดท้าย', () => {
  const g = fbEnvF(bookOf([]), () => fakeResponse(429, 'rate limited'));
  g.fbSnapRun_();
  eq(g.fbLastReport_().trail, 'อ้อม:429,อ้อม:429,ตรง:429,ตรง:429');
});

test('ทางอ้อมล้มกลางคัน = ต้องจดว่าล้ม พร้อมเหตุผลสั้นๆ', () => {
  const g = fbEnvF(bookOf([]), (url) => {
    if (url.indexOf('r.jina.ai') >= 0) throw new Error('Address unavailable');
    return fakeResponse(403, BLOCKED);
  });
  g.fbSnapRun_();
  const rep = g.fbLastReport_();
  eq(rep.trail, 'อ้อม:ล้ม,อ้อม:ล้ม,ตรง:403,ตรง:403');
  eq(rep.code, 403);
});

test('ได้ 200 แต่ไม่ใช่หน้าจริง = ต้องบอกว่าไม่ใช่หน้า ไม่ใช่บอกว่าสำเร็จ', () => {
  const g = fbEnvF(bookOf([]), () => fakeResponse(200, 'x'.repeat(2000)));
  g.fbSnapRun_();
  ok(g.fbLastReport_().trail.indexOf('(ไม่ใช่หน้า)') >= 0, 'ต้องติดป้ายว่าไม่ใช่หน้า');
});
