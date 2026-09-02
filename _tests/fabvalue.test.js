/* fabvalue.test.js — /สถิติค่าคุ้ม (ย้ายมาจาก PIKTAX 27 ส.ค. 69)
   ข้อที่ต้องพิสูจน์:
     1. ส่งใบก่อน จดชีตทีหลัง — จดไม่ลงก็ยังต้องได้ใบ ไม่ใช่เงียบหาย
     2. ทายสกอร์ '3-0' ต้องอยู่เป็นข้อความ ไม่ถูกชีตแปลงเป็นวันที่
     3. ตัดสินที่ "ฝั่ง" (1/2/X) ไม่ใช่สกอร์เป๊ะ — สกอร์เป๊ะจดคนละช่อง
     4. เกรดแล้วห้ามเกรดซ้ำ · ตอบผลใต้ใบเดิม (reply_to_message_id)
     5. หัวตาราง 20 ช่องต้องตรงกับ FBVALUE เดิมใน PIKTAX (ของเก่าจะถูกวางทับ) */

const { loadGas, fakeResponse } = require('./gasEnv');
const { FakeSpreadsheetApp } = require('./fakeSheet');

const FILES = ['gas/Config.gs', 'gas/Compat.gs', 'gas/Sheets.gs', 'gas/Api.gs',
  'gas/Forebet.gs', 'gas/Live.gs', 'gas/Settle.gs', 'gas/Tg.gs',
  'gas/FabScan.gs', 'gas/TalkFootball.gs', 'gas/FabValue.gs'];

const HEAD = ['เวลาเตือน','msg_id','match_id','ลีก','เจ้าบ้าน','เยือน','เตะเมื่อ',
  'ทายสกอร์','ฝั่ง','Prob','Coef','ค่าคุ้ม%','ชั้นความเข้ม','อ้างเข้า%',
  'สกอร์จบ','ผลจริง','ตัดสิน','สกอร์เป๊ะ','กำไร/ไม้','เกรดเมื่อ'];

/** แถวเต็ม 20 ช่อง · grade = [สกอร์จบ, ผลจริง, ตัดสิน, สกอร์เป๊ะ, กำไร/ไม้] หรือ null = ยังไม่รู้ผล */
function fvRow(id, side, coef, tier, pred, grade) {
  const g = grade || ['', '', '', '', ''];
  return ['2026-08-27 10:00:00', 900 + Number(String(id).replace(/\D/g, '') || 0),
          id, 'ลีก [TH]', 'A', 'B', '2026-08-27 21:30',
          pred, side, 70, coef, 40, tier, 73,
          g[0], g[1], g[2], g[3], g[4], g[4] === '' ? '' : '2026-08-27 23:30'];
}

function env(opt) {
  opt = opt || {};
  const props = Object.assign({ SHEET_ID: 'S', TG_TOKEN: 'T', TG_CHAT: '111', APP_KEY: 'kk' },
                              opt.props || {});
  const sent = [];
  let mid = 500;
  const app = new FakeSpreadsheetApp(opt.book || { PICKS: [['ID']] });
  const g = loadGas(FILES, {
    SpreadsheetApp: app,
    ContentService: { MimeType: { JSON: 'json' },
      createTextOutput: (t) => ({ getContent: () => t, setMimeType: function () { return this; } }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (k in props ? props[k] : null),
      setProperty: (k, v) => { props[k] = String(v); },
      deleteProperty: (k) => { delete props[k]; }
    }) },
    UrlFetchApp: { fetch: (url, o) => {
      const u = String(url);
      if (u.indexOf('api.telegram.org') >= 0) {
        sent.push(JSON.parse((o && o.payload) || '{}'));
        mid++;
        return fakeResponse(200, JSON.stringify({ ok: true, result: { message_id: mid } }));
      }
      return fakeResponse(404, '');
    } }
  });
  g.__sent = sent; g.__book = app.book;
  return g;
}

const META = JSON.stringify({ id: 'm1', lg: 'พรีเมียร์', cc: 'ENG', h: 'A', a: 'B',
  ko: '2026-08-27 21:30', hs: 3, gs: 0, side: '1', prob: 71, coef: 1.85,
  edge: 42, tier: 'เข้ม', claim: 73 });

/* ---------- 1. หัวตาราง ---------- */
test('หัวตาราง FBVALUE ต้องตรงกับของเดิมใน PIKTAX เป๊ะ 20 ช่อง', () => {
  const g = env();
  eq(g.SHEETS.FV, 'FBVALUE');
  eq(g.HEADERS.FV.length, 20);
  eq(g.HEADERS.FV.join('|'), HEAD.join('|'));
});

/* ---------- 2. fvAlert_ : ส่งใบ + จดชีต ---------- */
test('fvAlert_ ส่งใบเข้าเทเลแกรม แล้วจดแถวครบ 20 ช่อง พร้อม msg_id ที่ได้กลับมา', () => {
  const g = env();
  const out = g.fvAlert_('💎 ค่าคุ้ม A vs B', META);
  eq(out, 'fvalert OK 501');
  eq(g.__sent.length, 1);
  eq(g.__sent[0].text, '💎 ค่าคุ้ม A vs B');
  ok(g.__sent[0].reply_markup, 'ใบต้องมีปุ่มลัดติดไปด้วย');
  const rows = g.__book.sheets.FBVALUE.rows;
  eq(rows.length, 2);
  const r = rows[1];
  eq(r.length, 20);
  eq(r[1], 501);                       // msg_id
  eq(r[2], 'm1');
  eq(r[3], 'พรีเมียร์ [ENG]');
  eq(String(r[8]), '1');               // ชีตกลืน '1' เป็นเลข — ตอนเทียบต้อง String เสมอ ฝั่ง
  eq(r[10], 1.85);                     // Coef
  eq(r[12], 'เข้ม');
  eq(String(r[14]), '');               // สกอร์จบ ยังว่าง รอ fvgrade
});

test('ทายสกอร์ 3-0 ต้องอยู่เป็นข้อความ ไม่ถูกชีตแปลงเป็นวันที่', () => {
  const g = env();
  g.fvAlert_('ใบ', META);
  const sh = g.__book.sheets.FBVALUE;
  ok(sh.textCols.indexOf(8) >= 0, 'คอลัมน์ 8 (ทายสกอร์) ต้องถูกตั้งเป็น @');
  eq(sh.rows[1][7], '3-0');
});

test('fvAlert_ ไม่มี text = ไม่ส่ง ไม่จด', () => {
  const g = env();
  eq(g.fvAlert_('   ', META), 'fvalert: ไม่มี text');
  eq(g.__sent.length, 0);
});

test('fvAlert_ ยังไม่ได้ตั้ง TG_CHAT = บอกให้ไปตั้งก่อน', () => {
  const g = env({ props: { TG_CHAT: '' } });
  eq(g.fvAlert_('ใบ', META), 'fvalert: ยังไม่มี TG_CHAT (ตั้งด้วย ?p=setchat ก่อน)');
  eq(g.__sent.length, 0);
});

test('meta พัง = ยังส่งใบออกไปอยู่ดี (ใบสำคัญกว่าบันทึก)', () => {
  const g = env();
  eq(g.fvAlert_('ใบ', '{พัง'), 'fvalert OK 501');
  eq(g.__sent.length, 1);
});

test('จดชีตไม่ลง ก็ต้องได้ใบ ไม่ใช่เงียบหาย', () => {
  const g = env();
  g.sheetEnsure_ = () => { throw new Error('ชีตล็อกอยู่'); };
  const out = g.fvAlert_('ใบ', META);
  eq(g.__sent.length, 1, 'ใบต้องออกไปแล้ว');
  ok(/^fvalert OK 501 \(แต่จดชีตไม่ลง: ชีตล็อกอยู่\)$/.test(out), out);
});

/* ---------- 3. fvPending_ : ใบไหนยังไม่รู้ผล ---------- */
test('fvPending_ คืนเฉพาะคู่ที่ยังไม่ถูกเกรด', () => {
  const g = env({ book: { FBVALUE: [HEAD,
    fvRow('m1', '1', 1.85, 'เข้ม', '3-0', null),
    fvRow('m2', '2', 2.10, 'กลาง', '0-1', ['0-1', '2', 'ถูก', 'ตรง', 110]),
    fvRow('m3', 'X', 3.40, 'เข้ม', '1-1', null)] } });
  eq(g.fvPending_(), 'm1,m3');
});

test('fvPending_ ยังไม่มีแท็บ = ว่าง ไม่ระเบิด ไม่สร้างชีตเปล่า', () => {
  const g = env();
  eq(g.fvPending_(), '');
  ok(!g.__book.sheets.FBVALUE, 'ทางอ่านห้ามสร้างแท็บ');
});

/* ---------- 4. fvGrade_ : ตัดสินที่ "ฝั่ง" ---------- */
function graded(g, i) { return g.__book.sheets.FBVALUE.rows[i]; }

test('เดา 3-0 จบ 2-0 = ฝั่งถูก (สกอร์ไม่เป๊ะ ก็ยังนับว่าเข้า)', () => {
  const g = env({ book: { FBVALUE: [HEAD, fvRow('m1', '1', 1.85, 'เข้ม', '3-0', null)] } });
  const out = g.fvGrade_(JSON.stringify([{ id: 'm1', hs: 2, gs: 0 }]));
  eq(out, 'fvgrade OK เกรด 1 ใบ (เข้า 1)');
  const r = graded(g, 1);
  eq(r[14], '2-0');          // สกอร์จบ
  eq(String(r[15]), '1');    // ผลจริง
  eq(r[16], 'ถูก');
  eq(r[17], '');             // สกอร์เป๊ะ = ไม่
  eq(r[18], 85);             // (1.85-1)*100
});

test('เดา 3-0 จบ 3-0 = ฝั่งถูก + สกอร์เป๊ะ', () => {
  const g = env({ book: { FBVALUE: [HEAD, fvRow('m1', '1', 1.85, 'เข้ม', '3-0', null)] } });
  g.fvGrade_(JSON.stringify([{ id: 'm1', hs: 3, gs: 0 }]));
  eq(graded(g, 1)[17], 'ตรง');
});

test('ฝั่งผิด = เสียเต็มไม้ -100 ไม่ว่าเรทเท่าไร', () => {
  const g = env({ book: { FBVALUE: [HEAD, fvRow('m1', '1', 4.50, 'เข้ม', '3-0', null)] } });
  const out = g.fvGrade_(JSON.stringify([{ id: 'm1', hs: 0, gs: 2 }]));
  eq(out, 'fvgrade OK เกรด 1 ใบ (เข้า 0)');
  const r = graded(g, 1);
  eq(String(r[15]), '2');
  eq(r[16], 'ผิด');
  eq(r[18], -100);
});

test('เสมอ = ฝั่ง X', () => {
  const g = env({ book: { FBVALUE: [HEAD, fvRow('m1', 'X', 3.40, 'เข้ม', '1-1', null)] } });
  g.fvGrade_(JSON.stringify([{ id: 'm1', hs: 2, gs: 2 }]));
  eq(graded(g, 1)[16], 'ถูก');
});

test('เกรดแล้วห้ามเกรดซ้ำ — ตัวเลขเดิมต้องไม่ถูกทับ', () => {
  const g = env({ book: { FBVALUE: [HEAD,
    fvRow('m1', '1', 1.85, 'เข้ม', '3-0', ['3-0', '1', 'ถูก', 'ตรง', 85])] } });
  eq(g.fvGrade_(JSON.stringify([{ id: 'm1', hs: 0, gs: 5 }])), 'fvgrade OK เกรด 0 ใบ (เข้า 0)');
  eq(graded(g, 1)[16], 'ถูก');
  eq(g.__sent.length, 0);
});

test('ผลตอบกลับต้องไปห้อยใต้ใบเดิม (reply_to_message_id)', () => {
  const g = env({ book: { FBVALUE: [HEAD, fvRow('m1', '1', 1.85, 'เข้ม', '3-0', null)] } });
  g.fvGrade_(JSON.stringify([{ id: 'm1', hs: 3, gs: 0 }]));
  eq(g.__sent.length, 1);
  eq(g.__sent[0].reply_to_message_id, 901);
  ok(/^✅ เข้า — จบ 3-0 \(สกอร์เป๊ะด้วย\)/.test(g.__sent[0].text), g.__sent[0].text);
  ok(g.__sent[0].text.indexOf('กำไรไม้นี้ 85%') > 0, g.__sent[0].text);
});

test('ไม่เข้า = ใบตอบบอกเสีย 100%', () => {
  const g = env({ book: { FBVALUE: [HEAD, fvRow('m1', '1', 1.85, 'เข้ม', '3-0', null)] } });
  g.fvGrade_(JSON.stringify([{ id: 'm1', hs: 0, gs: 1 }]));
  ok(/^❌ ไม่เข้า — จบ 0-1 · ทายไว้ 3-0\n/.test(g.__sent[0].text), g.__sent[0].text);
  ok(g.__sent[0].text.indexOf('เสียไม้นี้ 100%') > 0, g.__sent[0].text);
});

test('fvGrade_ ข้อมูลพัง/ว่าง = บอกตรงๆ ไม่แตะชีต', () => {
  const g = env({ book: { FBVALUE: [HEAD, fvRow('m1', '1', 1.85, 'เข้ม', '3-0', null)] } });
  eq(g.fvGrade_('{พัง'), 'fvgrade: data ไม่ใช่ JSON');
  eq(g.fvGrade_('[]'), 'fvgrade: ไม่มีข้อมูล');
  eq(graded(g, 1)[16], '');
});

test('fvGrade_ ยังไม่มีแท็บ = บอกตรงๆ ไม่สร้างแท็บเปล่า', () => {
  const g = env();
  eq(g.fvGrade_(JSON.stringify([{ id: 'm1', hs: 1, gs: 0 }])), 'fvgrade: ยังไม่มีแท็บ FBVALUE');
  ok(!g.__book.sheets.FBVALUE);
});

test('สกอร์ไม่ใช่ตัวเลข = ข้าม ไม่เกรดมั่ว', () => {
  const g = env({ book: { FBVALUE: [HEAD, fvRow('m1', '1', 1.85, 'เข้ม', '3-0', null)] } });
  eq(g.fvGrade_(JSON.stringify([{ id: 'm1', hs: '', gs: 0 }])), 'fvgrade OK เกรด 0 ใบ (เข้า 0)');
  eq(graded(g, 1)[16], '');
});

/* ---------- 5. fvStatsText_ : สรุปจากของจริง ---------- */
test('ยังไม่มีแท็บ = บอกว่ายังไม่มีบันทึก ไม่ระเบิด', () => {
  eq(env().fvStatsText_(), '📊 ใบค่าคุ้มก่อนเกม — ยังไม่มีบันทึก');
});

test('ส่งไปแล้วแต่ยังไม่รู้ผลสักใบ = บอกจำนวนที่ค้าง', () => {
  const g = env({ book: { FBVALUE: [HEAD,
    fvRow('m1', '1', 1.85, 'เข้ม', '3-0', null),
    fvRow('m2', '2', 2.10, 'กลาง', '0-1', null)] } });
  eq(g.fvStatsText_(), '📊 ใบค่าคุ้มก่อนเกม — ส่งไปแล้ว 2 ใบ ยังไม่รู้ผลสักใบ');
});

test('สรุปรวม + แยกชั้นความเข้ม + ใบที่ยังค้าง', () => {
  const g = env({ book: { FBVALUE: [HEAD,
    fvRow('m1', '1', 1.85, 'เข้ม', '3-0', ['3-0', '1', 'ถูก', 'ตรง', 85]),
    fvRow('m2', '2', 2.10, 'เข้ม', '0-1', ['1-0', '1', 'ผิด', '', -100]),
    fvRow('m3', 'X', 3.40, 'กลาง', '1-1', ['2-2', 'X', 'ถูก', '', 240]),
    fvRow('m4', '1', 1.50, 'กลาง', '2-0', null)] } });
  const t = g.fvStatsText_();
  ok(t.indexOf('รวม 3 ใบ · เข้า 66.7%') >= 0, t);
  ok(t.indexOf('กำไร/ไม้ +75%') >= 0, t);
  ok(t.indexOf('สกอร์เป๊ะ 1 ใบ (33.3%)') >= 0, t);
  ok(t.indexOf('เข้ม — 2 ใบ · เข้า 50% · กำไร/ไม้ -7.5%') >= 0, t);
  ok(t.indexOf('กลาง — 1 ใบ · เข้า 100% · กำไร/ไม้ +240%') >= 0, t);
  ok(t.indexOf('⏳ ยังไม่รู้ผลอีก 1 ใบ') >= 0, t);
  ok(t.indexOf('⚠️ n ยังน้อย (3 ใบ)') >= 0, t);
});

test('n ถึง 30 แล้ว บรรทัดเตือนต้องหายไป', () => {
  const rows = [HEAD];
  for (let i = 0; i < 30; i++) {
    rows.push(fvRow('m' + i, '1', 2.00, 'เข้ม', '1-0', ['1-0', '1', 'ถูก', 'ตรง', 100]));
  }
  const t = env({ book: { FBVALUE: rows } }).fvStatsText_();
  ok(t.indexOf('รวม 30 ใบ · เข้า 100%') >= 0, t);
  eq(t.indexOf('⚠️ n ยังน้อย'), -1);
});

/* ---------- 6. ทางเข้า ---------- */
function doGet(g, q) { return JSON.parse(g.doGet({ parameter: q }).getContent()); }

test('4 ทางของ fv ต้องอยู่หลังกุญแจทั้งหมด (มันส่งข้อความออกและเขียนชีต)', () => {
  const g = env();
  ['fvalert', 'fvpending', 'fvgrade', 'fvstat'].forEach((p) => {
    const r = doGet(g, { p: p });
    ok(!r.ok, p + ' ต้องไม่ผ่านเมื่อไม่มีกุญแจ');
  });
  eq(g.__sent.length, 0);
});

test('?p=fvalert ใส่กุญแจแล้วส่งใบได้จริง', () => {
  const g = env();
  const r = doGet(g, { k: 'kk', p: 'fvalert', text: 'ใบทดสอบ', meta: META });
  eq(r.ok, true);
  eq(r['ผล'], 'fvalert OK 501');
  eq(g.__sent[0].text, 'ใบทดสอบ');
});

test('?p=fvpending / ?p=fvstat อ่านอย่างเดียว', () => {
  const g = env({ book: { FBVALUE: [HEAD, fvRow('m9', '1', 1.85, 'เข้ม', '3-0', null)] } });
  eq(doGet(g, { k: 'kk', p: 'fvpending' })['ค้าง'], 'm9');
  ok(doGet(g, { k: 'kk', p: 'fvstat' })['ข้อความ'].indexOf('ยังไม่รู้ผลสักใบ') > 0);
  eq(g.__sent.length, 0);
});

test('/สถิติค่าคุ้ม ในแชท = ตอบข้อความเดียว พร้อมปุ่มลัด', () => {
  const g = env({ book: { FBVALUE: [HEAD,
    fvRow('m1', '1', 1.85, 'เข้ม', '3-0', ['3-0', '1', 'ถูก', 'ตรง', 85])] } });
  g.tgHandle_({ message: { chat: { id: 111 }, text: '/สถิติค่าคุ้ม' } });
  eq(g.__sent.length, 1);
  ok(g.__sent[0].text.indexOf('รวม 1 ใบ · เข้า 100%') >= 0, g.__sent[0].text);
  ok(g.__sent[0].reply_markup, 'ต้องมีปุ่มลัดติดไปด้วย');
});

test('เมนู /help ต้องมีบรรทัด /สถิติค่าคุ้ม', () => {
  ok(env().TG_MENU_.indexOf('/สถิติค่าคุ้ม') >= 0);
});
