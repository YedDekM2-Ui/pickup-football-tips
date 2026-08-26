/* live.test.js — เวลาเตะต้องมาจากฟีด LiveScore (เวลา UTC ตายตัว) ไม่ใช่เวลาที่ forebet โชว์
   ข้อที่ต้องพิสูจน์: จับคู่ไม่ชัด = ต้องคืน null ให้ของเดิมทำงานต่อ ห้ามเดาเวลาขึ้นมาเอง */

const { loadGas, fakeResponse } = require('./gasEnv');

function lsEnv(stubs) {
  return loadGas(['gas/Live.gs'], stubs || {});
}

/* ---------- แปลงเวลา ---------- */

test('Esd เป็นเวลา UTC -> ต้องบวก 7 เป็นเวลาไทย', () => {
  const g = lsEnv();
  eq(g.lsEsdToThai_('20260826180000'), { date: '2026-08-27', time: '01:00' });
  eq(g.lsEsdToThai_('20260826090000'), { date: '2026-08-26', time: '16:00' });
  eq(g.lsEsdToThai_('20261231200000'), { date: '2027-01-01', time: '03:00' }, 'ข้ามปีต้องไม่พัง');
});

test('Esd อ่านไม่ออก = null ห้ามเดา', () => {
  const g = lsEnv();
  eq(g.lsEsdToThai_(''), null);
  eq(g.lsEsdToThai_('2026-08-26 18:00'), null);
  eq(g.lsEsdToThai_('20260826'), null);
  eq(g.lsEsdToThai_(null), null);
});

/* ---------- ชื่อทีม ---------- */

test('ตัดชื่อทีมให้เหลือแก่นก่อนเทียบ', () => {
  const g = lsEnv();
  eq(g.lsNorm_('Sparta Praha FC'), 'sparta prague', 'ตัด FC + แปลชื่อเมือง');
  eq(g.lsNorm_('OH Leuven W'), 'oh leuven w');
  eq(g.lsNorm_('  Bayern   Munchen  '), 'bayern munich');
  eq(g.lsNorm_('FC'), 'fc', 'ตัดจนเกลี้ยง = เอาของเดิมไป ดีกว่าคืนค่าว่าง');
  eq(g.lsNorm_(null), '');
});

test('ทีมเดียวกันแม้เขียนไม่เหมือนกัน', () => {
  const g = lsEnv();
  ok(g.lsSameTeam_('Czarni Sosnowiec W', 'Czarni Sosnowiec W'));
  ok(g.lsSameTeam_('Leuven', 'OH Leuven W'), 'ชื่อสั้นอยู่ในชื่อยาว');
  ok(g.lsSameTeam_('Sparta Praha', 'Sparta Prague FC'));
});

test('คนละทีมต้องไม่จับคู่ให้', () => {
  const g = lsEnv();
  ok(!g.lsSameTeam_('Real Madrid', 'Atletico Madrid'));
  ok(!g.lsSameTeam_('Czarni Sosnowiec W', 'OH Leuven W'));
  ok(!g.lsSameTeam_('', 'OH Leuven W'), 'ชื่อว่าง = ไม่ใช่');
  ok(!g.lsSameTeam_('Nice', 'Ferencvaros'), 'ชื่อสั้นกว่า 5 ตัวห้ามจับแบบมั่ว');
});

/* ---------- หาเวลาเตะ ---------- */

const POOL = [
  { h: 'Czarni Sosnowiec W', a: 'OH Leuven W', esd: '20260826160000' },
  { h: 'Real Madrid',        a: 'Barcelona',   esd: '20260826200000' }
];

test('เจอคู่เดียว = ใช้เวลาไทยจากฟีด', () => {
  const g = lsEnv();
  eq(g.lsWhenThai_('Czarni Sosnowiec W', 'OH Leuven W', '2026-08-26', POOL),
     { date: '2026-08-26', time: '23:00' }, '16:00 UTC = 23:00 ไทย (ไม่ใช่ 02:00 ที่หน้าเว็บโชว์)');
});

test('หาไม่เจอ = null ให้ของเดิมทำงานต่อ', () => {
  const g = lsEnv();
  eq(g.lsWhenThai_('Arsenal', 'Chelsea', '2026-08-26', POOL), null);
});

/* เคสจริง 26 ส.ค. 69: forebet เขียน "OH Leuven W" ฟีดเขียน "Oud-Heverlee Leuven"
   ถ้าบังคับให้ตรงทั้งสองทีม คู่ที่เจ้าของแทงจริงจะหลุด แล้วกลับไปใช้เวลาเพี้ยนแบบเดิม */
const POOL_REAL = [
  { h: 'Czarni Sosnowiec W', a: 'Oud-Heverlee Leuven', esd: '20260826170000',
    c: "UEFA Women's Champions League" }
];

test('ชื่อทีมคนละแบบ ตรงข้างเดียว + มีคู่เดียว = เอาได้', () => {
  const g = lsEnv();
  eq(g.lsWhenThai_('Czarni Sosnowiec W', 'OH Leuven W', '2026-08-26', POOL_REAL),
     { date: '2026-08-27', time: '00:00' }, '17:00 UTC = เที่ยงคืนไทยของวันที่ 27');
});

test('ตรงข้างเดียวแต่มีหลายคู่ = null ห้ามเดา', () => {
  const g = lsEnv();
  const dup = POOL_REAL.concat([{ h: 'Czarni Sosnowiec W', a: 'Slavia Praha W',
                                  esd: '20260828170000', c: "UEFA Women's Champions League" }]);
  eq(g.lsWhenThai_('Czarni Sosnowiec W', 'OH Leuven W', '2026-08-26', dup), null);
});

test('บอลหญิงห้ามไปจับเวลาของบอลชายชื่อเดียวกัน', () => {
  const g = lsEnv();
  const men = [{ h: 'Barcelona', a: 'Real Madrid', esd: '20260826190000', c: 'LaLiga' }];
  eq(g.lsWhenThai_('Barcelona W', 'Real Madrid W', '2026-08-26', men), null);
});

test('เจอเกิน 1 คู่ = null ห้ามเดาว่าอันไหน', () => {
  const g = lsEnv();
  const dup = POOL.concat([{ h: 'Czarni Sosnowiec W', a: 'OH Leuven W', esd: '20260827160000' }]);
  eq(g.lsWhenThai_('Czarni Sosnowiec W', 'OH Leuven W', '2026-08-26', dup), null);
});

/* ---------- ยิงฟีด ---------- */

const FEED = JSON.stringify({
  Stages: [{
    Snm: 'Champions League Women',
    Events: [
      { Eid: '1', T1: [{ Nm: 'Czarni Sosnowiec W' }], T2: [{ Nm: 'OH Leuven W' }], Esd: '20260826160000' },
      { Eid: '2', T1: [{ Nm: 'ไม่มี Esd' }], T2: [{ Nm: 'x' }] },
      { Eid: '3', T2: [{ Nm: 'ไม่มีทีมเหย้า' }], Esd: '20260826160000' }
    ]
  }]
});

test('อ่านฟีดได้ + ทิ้งแถวที่ข้อมูลไม่ครบ', () => {
  const g = lsEnv({ UrlFetchApp: { fetch: () => fakeResponse(200, FEED) } });
  const rows = g.lsFetchDay_('20260826');
  eq(rows.length, 1, 'เหลือแถวที่ครบจริงแถวเดียว');
  eq(rows[0].h, 'Czarni Sosnowiec W');
  eq(rows[0].esd, '20260826160000');
});

test('ฟีดล่ม = คืนลิสต์ว่าง ห้ามทำรอบดึงพังทั้งรอบ', () => {
  eq(lsEnv({ UrlFetchApp: { fetch: () => fakeResponse(403, 'nope') } }).lsFetchDay_('20260826'), []);
  eq(lsEnv({ UrlFetchApp: { fetch: () => fakeResponse(200, '<html>') } }).lsFetchDay_('20260826'), []);
  eq(lsEnv({ UrlFetchApp: { fetch: () => { throw new Error('timeout'); } } }).lsFetchDay_('20260826'), []);
});

test('ดึง 3 วันรอบๆ — คู่ดึกเวลายุโรปไปโผล่คนละวันใน UTC', () => {
  const g = lsEnv();
  eq(g.lsDays_('2026-08-26'), ['20260825', '20260826', '20260827']);
  eq(g.lsDays_('2026-01-01'), ['20251231', '20260101', '20260102'], 'ข้ามปีต้องไม่พัง');
});

test('วันเดิมในรอบเดียวกันต้องไม่ยิงซ้ำ', () => {
  let n = 0;
  const g = lsEnv({ UrlFetchApp: { fetch: () => { n++; return fakeResponse(200, FEED); } } });
  g.lsPool_('2026-08-26');
  g.lsPool_('2026-08-26');
  eq(n, 3, 'ยิงแค่ 3 วันครั้งเดียว รอบสองใช้ของที่จำไว้');
});
