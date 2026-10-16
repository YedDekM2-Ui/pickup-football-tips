// _tests/star.test.js — สมุดดวงแกะดาว: สูตร (web/js/star-calc.js) + หลังบ้าน (gas/LotStar.gs)
'use strict';
const C = require('../web/js/star-calc.js');
const R = require('../web/js/star-read.js');
const TPL = require('../web/js/star-tpl.js');
const TRUTH = require('./fixtures/star-truth.js');
const RES = require('./fixtures/star-results.json');
const { loadGas } = require('./gasEnv');

const charts = TRUTH.map((t) => ({ date: t.date, rasi: t.rasi, lagna: t.lagna, center: t.center.join('/'),
  lunar: t.lunar, moved: t.moved, special: t.special }));
const lao = C.scResultMap_('lao', RES.lao);
const thai = C.scResultMap_('thai', RES.thai);

test('วันในสัปดาห์ + นักษัตรประจำวัน (1 ม.ค. 2000 = วันมะเมีย)', () => {
  eq(C.scWd_('2026-10-16'), 5);
  eq(C.scDayBranch_('2000-01-01'), 6);
  eq(C.scDayBranch_('2000-01-02'), 7);
});

test('ดาวประจำวัน — หวยลาวพุธกลางคืนเป็นราหู 8 · หวยไทยพุธกลางวันเป็น 4', () => {
  eq(C.scDayStar_(3, true), '8');
  eq(C.scDayStar_(3, false), '4');
  eq(C.scDayStar_(0, true), '1');
  eq(C.scDayStar_(6, false), '7');
});

test('กาลกิณีตามตารางในสูตร (พุธกลางวัน 3 · พุธกลางคืน 5)', () => {
  eq([0, 1, 2, 4, 5, 6].map((w) => C.scKalakini_(w, false)), ['6', '1', '2', '8', '7', '4']);
  eq(C.scKalakini_(3, false), '3');
  eq(C.scKalakini_(3, true), '5');
});

test('จันทรคติที่เดาเอง ตรงกับรูปจริงทั้ง 10 วัน', () => {
  TRUTH.forEach((t) => {
    const g = C.scLunarGuess_(t.date), real = C.scLunarParse_(t.lunar);
    eq([g.side, g.day, g.month], [real.side, real.day, real.month], t.date);
  });
});

test('อ่านจันทรคติเลขไทยได้', () => {
  eq(C.scLunarParse_('แรม ๑๓ ค่ำ เดือน ๑๐'), { side: 'แรม', day: 13, month: 10 });
  eq(C.scLunarParse_('ขึ้น 4 ค่ำ'), { side: 'ขึ้น', day: 4, month: 0 });
  eq(C.scLunarParse_(''), null);
});

test('ผลหวย → เลขแยกหลัก (ลาว 4 · ไทย 4+2) เลข 0 หน้าไม่หาย', () => {
  eq(lao['2026-10-14'], ['0', '3', '5', '8']);
  eq(thai['2026-10-01'], ['2', '7', '0', '1', '7', '0']);
  eq(C.scResultMap_('lao', [['2026-01-01', '123']]), {});
});

test('งวดถัดไป: ลาว จ-ศ ก่อน 20:30 · ไทย 1/16 ก่อน 16:00', () => {
  /* 16 ต.ค. 69 ศุกร์ 10:00 ไทย = 03:00Z */
  eq(C.scNextDraw_('lao', new Date('2026-10-16T03:00:00Z')), '2026-10-16');
  eq(C.scNextDraw_('lao', new Date('2026-10-16T14:00:00Z')), '2026-10-19');
  eq(C.scNextDraw_('thai', new Date('2026-10-16T03:00:00Z')), '2026-10-16');
  eq(C.scNextDraw_('thai', new Date('2026-10-16T10:00:00Z')), '2026-11-01');
});

test('ดวงที่ใช้ทาย = ดวงวันนั้น ไม่งั้นดวงล่าสุดก่อนหน้า', () => {
  eq(C.scPickChart_(charts, '2026-10-16', 'lao').date, '2026-10-15');
  eq(C.scPickChart_(charts, '2026-10-12', 'lao').date, '2026-10-12');
  eq(C.scPickChart_(charts, '2026-09-01', 'lao'), null);
});

test('เลขเสีย: คู่ศัตรู 2-5 ในกรกฎ (5 ต.ค.) ถูกจับ', () => {
  const ctx = C.scCtx_('lao', charts[1], '2026-10-05', lao);
  const why = C.scDead_(ctx).map((x) => x.d + ':' + x.why).join('|');
  ok(/2:คู่ศัตรู 2-5/.test(why) && /5:คู่ศัตรู 2-5/.test(why), why);
  ok(/^1:กาลกิณีวันจันทร์/.test(why), why);
});

test('วิธีค้นใช้ข้อมูลจริงของดวง (ศุกร์ 9 ต.ค.: ศุกร์ 6 ดาววัน · จันทร์กุมอาทิตย์ในกันย์)', () => {
  const m = C.scMethods_(C.scCtx_('lao', charts[5], '2026-10-09', lao));
  ok(m.day['6'] && m.day['6'].s >= 1);
  ok(m.moon['1'] && /กุมจันทร์ในกันย์/.test(m.moon['1'].why.join()));
  ok(m.power['2'] && /ย้ายราศีวันนี้/.test(m.power['2'].why.join()));
  ok(m.center['7'], 'กลางดวง 21+26=47 → 7');
});

test('ทำนายคืนครบทุกหลัก + เลขชุด + เลขปิด 2 ตัว', () => {
  const w = C.scWeights_('lao', charts, lao, '2026-10-16');
  const pr = C.scPredict_('lao', charts[9], '2026-10-16', lao, w);
  eq(pr.pos.length, 4);
  pr.pos.forEach((p) => { eq(p.top.length, 3); eq(p.closed.length, 2); eq(p.rank.length, 10); });
  eq(pr.sets.map((s) => s.name), ['4 ตัว', '3 ตัวบน', '2 ตัวบน', '3 ตัวล่าง', '2 ตัวล่าง'], 'ลาวคิดจาก 4 ตัว แยกบน/ล่าง');
  pr.sets.forEach((s) => ok(s.list.length === 6 && s.list.every((n) => /^\d+$/.test(n))));
  const pt = C.scPredict_('thai', charts[9], '2026-10-16', thai, null);
  eq(pt.pos.map((p) => p.name), ['พัน', 'ร้อย', 'สิบ', 'หน่วย', 'ล่างสิบ', 'ล่างหน่วย']);
  eq(pt.sets.map((s) => s.name), ['4 ตัวบน', '3 ตัวบน', '2 ตัวล่าง'], 'ไทยคิดจาก 4 ตัวบน + 2 ตัวล่าง · โชว์ 3 ตัวบนด้วย');
  ok(pt.sets[0].list.every((n) => n.length === 4) && pt.sets[1].list.every((n) => n.length === 3) && pt.sets[2].list.every((n) => n.length === 2));
});

test('น้ำหนักไม่โกงอนาคต: วัดก่อนดวงแรก = ไม่มีข้อมูล ทุกวิธีเท่าสุ่ม', () => {
  const w = C.scWeights_('lao', charts, lao, '2026-10-02');
  eq(w.n, 0);
  C.SC_METHODS.forEach((m) => w.w[m[0]].forEach((x) => eq(x.w, 1)));
  eq(C.scWeights_('lao', charts, lao).n, 10);
});

test('วัดย้อนหลังครบ 10 ดวงที่มีผลลาว · 40 หลัก', () => {
  const bt = C.scBacktest_('lao', charts, lao);
  eq(bt.rows.length, 10);
  eq(bt.n, 40);
  eq(bt.rows[0].real, '4693');
});

test('สถิติแยกหลัก นับครบตามจำนวนงวด', () => {
  const st = C.scStats_('lao', lao, 30);
  eq(st.n, 30);
  st.pos.forEach((p) => eq(p.cnt.reduce((a, b) => a + b, 0), 30));
  eq(C.scStats_('thai', thai, 0).total, Object.keys(thai).length);
});

test('ตำแหน่ง → ราศี ตามผังดวง (มุมแบ่งด้วยเส้นทแยง)', () => {
  const g = { x1: 377, x2: 494, y1: 968, y2: 1086 };
  eq(R.srRasiAt_(g, 435, 800), 0);
  eq(R.srRasiAt_(g, 320, 835), 1);
  eq(R.srRasiAt_(g, 237, 917), 2);
  eq(R.srRasiAt_(g, 220, 1030), 3);
  eq(R.srRasiAt_(g, 237, 1143), 4);
  eq(R.srRasiAt_(g, 343, 1188), 5);
  eq(R.srRasiAt_(g, 548, 1229), 7);
  eq(R.srRasiAt_(g, 632, 918), 10);
  eq(R.srRasiAt_(g, 548, 834), 11);
  eq(R.srRasiAt_(g, 435, 1027), -1);
});

test('แม่แบบตัวเลขครบ 0-9 + ลัคนา + / ', () => {
  const chs = [...new Set(TPL.map((t) => t.ch))].sort().join('');
  eq(chs, '/0123456789ล');
});

/* ---------------- หลังบ้าน ---------------- */
function gas() {
  return loadGas(['gas/LotStar.gs'], { lotIso_: (v) => String(v).slice(0, 10), nowIso_: () => '2026-10-16T10:00:00+07:00' });
}

test('stClean_ รับดวงถูกรูป ตัดช่องแปลกทิ้ง', () => {
  const c = gas().stClean_({ date: '2026-10-15', rasi: charts[9].rasi, lagna: 1, center: '27/24x', lunar: 'ขึ้น 4 ค่ำ' });
  eq(c.center, '27/24');
  eq(c.lagna, 1);
  eq(c.rasi[6], ['9', '6', '4']);
});

test('stClean_ ปฏิเสธดวงผิดรูป (ดาวซ้ำ 2 ราศี / วันที่ผิด / ไม่ครบ 12 ช่อง)', () => {
  const g = gas();
  const dup = charts[9].rasi.map((c) => c.slice()); dup[0].push('9');
  throws(() => g.stClean_({ date: '2026-10-15', rasi: dup }), /อยู่ 2 ราศี/);
  throws(() => g.stClean_({ date: '15/10/69', rasi: charts[9].rasi }), /วันที่/);
  throws(() => g.stClean_({ date: '2026-10-15', rasi: [[]] }), /12 ช่อง/);
});

test('แถวชีต ↔ ดวง ไปกลับไม่เพี้ยน', () => {
  const g = gas();
  const c = g.stClean_(Object.assign({}, charts[2]));
  const back = g.stParse_(g.stRowOf_(c));
  eq(back.rasi, c.rasi); eq(back.date, c.date); eq(back.center, '18/28'); eq(back.lunar, c.lunar);
});

/* ---------------- ชุดวันหวยไทยออก (รูปเจ้าของ 16 ต.ค. 69 · 16 พ.ค.–1 ต.ค. 69) ---------------- */
const TH = require('./fixtures/star-truth-thai.js').map((t) => ({ date: t.date, rasi: t.rasi, lagna: t.lagna,
  center: t.center.join('/'), lunar: t.lunar, moved: t.moved }));

test('ดวงหวยไทย: ดาวครบ 10 ดวงไม่ซ้ำ + ลัคนาอยู่ในวง', () => {
  TH.forEach((c) => {
    const all = c.rasi.flat().sort().join('');
    eq(all, '0123456789', c.date);
    ok(c.lagna >= 0 && c.lagna <= 11, c.date);
  });
});

test('อ่านจันทรคติเดือนแปดหลังได้ (เดือน 8 ซ้ำปีอธิกมาส)', () => {
  eq(C.scLunarParse_('ขึ้น 2 ค่ำ เดือน 8 (แปดหลัง)'), { side: 'ขึ้น', day: 2, month: 8 });
});

test('วัดย้อนหลังหวยไทยครบ 10 งวด · 60 หลัก (4 ตัวบน + 2 ตัวล่าง)', () => {
  const bt = C.scBacktest_('thai', TH, thai);
  eq(bt.rows.length, 10);
  eq(bt.n, 60);
  eq(bt.rows[9].real, '270170');
});

test('stResult_ หวยไทย 6 หลัก → 4 ตัวบน = 4 ตัวท้าย + เติมหน้า/ท้าย 3 ตัวครบแถว', () => {
  const calls = [], merged = [];
  const g = loadGas(['gas/LotStar.gs'], {
    recordThaiResult_: (a, b, iso) => { calls.push([a, b, iso]); return '✅ บันทึก'; },
    recordLaoResult_: () => '✅',
    lotMergeRows_: (sh, h, rows) => merged.push(rows[0]),
    lotPad_: (v, n) => String(v).padStart(n, '0'),
    lotPadList_: (v) => String(v),
    lotThaiDateLabel_: () => '1 ตุลาคม 2569',
    THAI_LOT: { SHEET: 'Thai_Lottery', HEADERS: [] }
  });
  const r = g.stResult_('thai', '2026-10-01', '402701', '70', '791/912', '058 396');
  ok(r.ok);
  eq(calls[0], ['2701', '70', '2026-10-01']);
  eq(merged[0], ['2026-10-01', 'งวด 1 ตุลาคม 2569', '2701', '70', '402701', '791/912', '058/396']);
  g.stResult_('thai', '2026-10-01', '2701', '70');
  eq(merged.length, 1, 'ส่งมา 4 หลัก = ไม่แตะคอลัมน์รางวัลที่ 1');
});

/* ---------------- รอบ 3: ดวงแยกชนิด · เส้นหลอก · กรอกผล ---------------- */
test('วันที่ 1/16 มีดวงไทย 15:30 กับดวงลาว 20:20 — ทายหวยไหนหยิบดวงชนิดนั้น', () => {
  const th = { date: '2026-10-16', kind: 'thai', rasi: charts[9].rasi, lagna: 10 };
  const la = { date: '2026-10-16', kind: 'lao', rasi: charts[9].rasi, lagna: 1 };
  const all = charts.concat([th, la]);
  eq(C.scPickChart_(all, '2026-10-16', 'thai').lagna, 10);
  eq(C.scPickChart_(all, '2026-10-16', 'lao').lagna, 1);
  eq(C.scPickChart_(charts.concat([th]), '2026-10-16', 'lao').date, '2026-10-16', 'ไม่มีดวงลาววันนั้น = ยืมดวงไทยวันเดียวกันได้');
  ok(C.scFits_({ kind: '' }, 'lao') && !C.scFits_({ kind: 'thai' }, 'lao'));
});

test('วัดย้อนหลังลาวไม่เอาดวงไทยมานับ', () => {
  const th = TH.map((c) => Object.assign({ kind: 'thai' }, c));
  eq(C.scBacktest_('lao', charts.concat(th), lao).rows.length, 10);
});

test('งวดล่าสุด/งวดที่ยังไม่กรอก (ลาวก่อน 20:30 = ยังไม่ออก)', () => {
  eq(C.scLastDraw_('lao', new Date('2026-10-16T05:00:00Z')), '2026-10-15');   /* ศ. 12:00 */
  eq(C.scLastDraw_('lao', new Date('2026-10-16T14:00:00Z')), '2026-10-16');   /* ศ. 21:00 */
  eq(C.scLastDraw_('thai', new Date('2026-10-16T05:00:00Z')), '2026-10-01');
  eq(C.scLastDraw_('thai', new Date('2026-10-16T10:00:00Z')), '2026-10-16');
  eq(C.scMissingDraws_('lao', lao, 10, new Date('2026-10-16T14:00:00Z')), ['2026-10-16']);
});

test('ตัวอ่านเลือกคู่เส้นที่เป็นจัตุรัส ไม่หลงเส้นคั่นที่ยาวกว่า (รูปต้นฉบับไอโฟน 16 ต.ค. 69)', () => {
  const vx = { cand: [{ pos: 377, len: 523 }, { pos: 494, len: 522 }, { pos: 31, len: 1250 }, { pos: 839, len: 1250 }] };
  const hy = { cand: [{ pos: 516, len: 754 }, { pos: 968, len: 522 }, { pos: 1087, len: 522 }] };
  const sq = R.srPickSquare_(vx, hy);
  eq([sq.x.p1, sq.x.p2, sq.y.p1, sq.y.p2], [377, 494, 968, 1087]);
  eq(R.srPickSquare_({ cand: [{ pos: 31, len: 900 }] }, hy), null);
});

test('กุญแจดูอย่างเดียว (ลิงก์ของแม่): อ่านได้ ติดป้าย readOnly · เขียน/ลบ/ลงผล ไม่ได้ทุกทาง', () => {
  const props = { STAR_VIEW_KEY: 'view1', STAR_KEY: 'own1' };
  let wrote = 0;
  const g = loadGas(['gas/LotStar.gs'], {
    prop_: (k) => props[k] || '',
    keyOk_: () => false
  });
  g.stPayload_ = () => ({ ok: true, charts: [] });
  g.stSave_ = () => { wrote++; return { ok: true }; };
  g.stDel_ = () => { wrote++; return { ok: true }; };
  g.stResult_ = () => { wrote++; return { ok: true }; };
  const r = g.stRoute_('star', { k: 'view1' }, {});
  ok(r.ok && r.readOnly === true);
  ['starsave', 'stardel', 'starresult'].forEach((p) => {
    const w = g.stRoute_(p, { k: 'view1' }, { chart: {} });
    ok(!w.ok && w.readOnly, p);
  });
  eq(wrote, 0, 'ห้ามเขียนชีตเลย');
  ok(g.stRoute_('star', { k: 'own1' }, {}).readOnly === undefined, 'กุญแจเจ้าของไม่ติดป้ายดูอย่างเดียว');
  ok(g.stRoute_('star', { k: 'xx' }, {}).needKey);
});

test('สถิติ 10 งวด: ดับ = เลขที่ออกน้อยสุดทุกตัว (เสมอกันโชว์หมด) · เด่น ต้องบ่อยกว่าค่าเฉลี่ย', () => {
  const st = C.scStats_('lao', lao, 10);
  st.pos.forEach((p) => {
    const zeros = p.cnt.map((c, d) => (c === 0 ? d : -1)).filter((d) => d >= 0);
    if (zeros.length) eq(p.cold, zeros, p.name);
    p.hot.forEach((d) => ok(p.cnt[d] > 1, p.name + ' เด่นต้องออกเกิน 1 ครั้งใน 10 งวด'));
  });
});
