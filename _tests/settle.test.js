/* settle.test.js — คิดผลบิลเป็นเงิน
   ข้อที่ต้องพิสูจน์: คิดไม่ได้ต้องคืน null (ไม่แตะแถว) ห้ามเดาผลออกมาเป็นตัวเลขเงิน */

const { loadGas } = require('./gasEnv');
const { FakeSpreadsheetApp } = require('./fakeSheet');

const HEAD_BETS = ['ID','Parent_ID','Bill_Type','วันที่','ลีก','ทีมเหย้า','ทีมเยือน',
  'ทีมที่เลือก','คู่แข่ง','ตลาด','แฮนดิแคป','เส้น','ทายสกอร์','ราคา','เงิน','เวลาเตะ',
  'สถานะ','สกอร์เหย้า','สกอร์เยือน','ผล','กำไร','Telegram_Message_ID','กุญแจกันซ้ำ',
  'สร้างเมื่อ','อัปเดตเมื่อ'];

function bet(o) {
  const g = { 'ID':'B1', 'Parent_ID':'', 'Bill_Type':'MAIN', 'วันที่':'2026-08-25', 'ลีก':'',
    'ทีมเหย้า':'Arsenal', 'ทีมเยือน':'Chelsea', 'ทีมที่เลือก':'Arsenal', 'คู่แข่ง':'Chelsea',
    'ตลาด':'AH', 'แฮนดิแคป':0, 'เส้น':'', 'ทายสกอร์':'', 'ราคา':1.78, 'เงิน':300,
    'เวลาเตะ':'2026-08-25T21:45:00+07:00', 'สถานะ':'รอเตะ', 'สกอร์เหย้า':'', 'สกอร์เยือน':'',
    'ผล':'', 'กำไร':'', 'Telegram_Message_ID':'', 'กุญแจกันซ้ำ':'', 'สร้างเมื่อ':'', 'อัปเดตเมื่อ':'' };
  return Object.assign(g, o);
}
function bookOf(bets) {
  return { BETS: [HEAD_BETS].concat(bets.map(b => HEAD_BETS.map(h => b[h]))) };
}
function env(book, stubs) {
  return loadGas(['gas/Config.gs', 'gas/Sheets.gs', 'gas/Api.gs', 'gas/Live.gs', 'gas/Settle.gs'],
    Object.assign({
      SpreadsheetApp: new FakeSpreadsheetApp(book || {}),
      PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k === 'SHEET_ID' ? 'S' : null) }) },
      Utilities: { formatDate: () => '2026-08-26T10:00:00' }
    }, stubs || {}));
}

/* ---------- เส้นแบ่งแพ้ชนะ ---------- */

test('ระยะห่างจากเส้น -> ผล ตามลูกครึ่ง', () => {
  const g = env();
  eq(g.stlVerdict_(1), 'WIN_FULL');
  eq(g.stlVerdict_(0.5), 'WIN_FULL');
  eq(g.stlVerdict_(0.25), 'WIN_HALF', 'ชนะครึ่งลูก');
  eq(g.stlVerdict_(0), 'PUSH', 'เสมอเส้น = คืนทุน');
  eq(g.stlVerdict_(-0.25), 'LOSS_HALF', 'แพ้ครึ่งลูก');
  eq(g.stlVerdict_(-0.5), 'LOSS_FULL');
  eq(g.stlVerdict_(-2), 'LOSS_FULL');
});

test('ระยะห่างที่เกิดไม่ได้จริง = ไม่ตัดสิน', () => {
  const g = env();
  eq(g.stlVerdict_(0.1), '', 'เส้นบอลเป็นทวีคูณของ 0.25 เสมอ เจอ 0.1 = ข้อมูลเพี้ยน');
  eq(g.stlVerdict_(-0.1), '');
  eq(g.stlVerdict_('x'), '');
});

/* ---------- เงิน ---------- */

test('กำไรจากใบจริง 300 @ 1.78', () => {
  const g = env();
  eq(g.stlProfit_('WIN_FULL', 300, 1.78), 234);
  eq(g.stlProfit_('WIN_HALF', 300, 1.78), 117);
  eq(g.stlProfit_('PUSH', 300, 1.78), 0, 'คืนทุน = ไม่ได้ไม่เสีย');
  eq(g.stlProfit_('LOSS_HALF', 300, 1.78), -150, 'แพ้ครึ่ง = เสียครึ่งเงินแทง ไม่เกี่ยวกับราคา');
  eq(g.stlProfit_('LOSS_FULL', 300, 1.78), -300);
});

test('กำไรปัดทศนิยม 2 ตำแหน่ง', () => {
  const g = env();
  eq(g.stlProfit_('WIN_FULL', 100, 1.833), 83.3);
  eq(g.stlProfit_('WIN_HALF', 175, 1.91), 79.63, '175*0.91/2 = 79.625');
  eq(g.stlProfit_('อะไรไม่รู้', 300, 1.78), '', 'ผลที่ระบบไม่รู้จัก = ไม่คิดเงิน');
});

/* ---------- แฮนดิแคป ---------- */

test('แฮนดิแคป: เลือกเหย้า', () => {
  const g = env();
  const b = h => bet({ 'ตลาด':'AH', 'ทีมที่เลือก':'Arsenal', 'แฮนดิแคป':h });
  eq(g.stlOne_(b(0), 2, 1)['ผล'], 'WIN_FULL', 'เสมอราคา ชนะจริง');
  eq(g.stlOne_(b(0), 1, 1)['ผล'], 'PUSH', 'เสมอราคา เสมอจริง = คืนทุน');
  eq(g.stlOne_(b(-0.5), 1, 1)['ผล'], 'LOSS_FULL', 'ต่อครึ่งลูก เสมอ = แพ้เต็ม');
  eq(g.stlOne_(b(-0.25), 1, 1)['ผล'], 'LOSS_HALF', 'ต่อ 0-0.5 เสมอ = เสียครึ่ง');
  eq(g.stlOne_(b(0.25), 1, 1)['ผล'], 'WIN_HALF', 'รอง 0-0.5 เสมอ = ได้ครึ่ง');
  eq(g.stlOne_(b(-1), 2, 1)['ผล'], 'PUSH', 'ต่อลูก ชนะ 1 ลูก = คืนทุน');
  eq(g.stlOne_(b(-1.5), 3, 1)['ผล'], 'WIN_FULL');
});

test('แฮนดิแคป: เลือกเยือน กลับข้างสกอร์', () => {
  const g = env();
  const b = h => bet({ 'ตลาด':'AH', 'ทีมที่เลือก':'Chelsea', 'คู่แข่ง':'Arsenal', 'แฮนดิแคป':h });
  eq(g.stlOne_(b(0.5), 1, 1)['ผล'], 'WIN_FULL', 'รองครึ่งลูก เสมอ = ชนะ');
  eq(g.stlOne_(b(0.5), 2, 1)['ผล'], 'LOSS_FULL', 'เยือนแพ้ 1 ลูก รองครึ่ง = แพ้');
  eq(g.stlOne_(b(1), 1, 0)['ผล'], 'PUSH');
  eq(g.stlOne_(b(-0.5), 1, 2)['ผล'], 'WIN_FULL', 'เยือนต่อครึ่ง แล้วชนะ');
});

test('แฮนดิแคปคิดไม่ได้ = null ห้ามเดา', () => {
  const g = env();
  eq(g.stlOne_(bet({ 'แฮนดิแคป':'' }), 1, 0), null, 'ไม่กรอกแฮนดิแคป ต่างจากแฮนดิแคป 0');
  eq(g.stlOne_(bet({ 'ทีมที่เลือก':'Liverpool' }), 1, 0), null, 'เลือกทีมที่ไม่ได้อยู่ในคู่นี้');
  eq(g.stlOne_(bet({ 'ทีมที่เลือก':'' }), 1, 0), null);
});

/* ---------- สูง/ต่ำ ---------- */

test('สูง/ต่ำ: เส้นบวก = สูง เส้นลบ = ต่ำ (ตรงกับที่หน้า 2 โชว์)', () => {
  const g = env();
  const b = l => bet({ 'ตลาด':'OVER_UNDER', 'เส้น':l, 'แฮนดิแคป':'' });
  eq(g.stlOne_(b(2.5), 2, 1)['ผล'], 'WIN_FULL', 'สูง 2.5 ได้ 3 ลูก');
  eq(g.stlOne_(b(2.5), 1, 1)['ผล'], 'LOSS_FULL');
  eq(g.stlOne_(b(-2.5), 1, 1)['ผล'], 'WIN_FULL', 'ต่ำ 2.5 ได้ 2 ลูก');
  eq(g.stlOne_(b(3), 2, 1)['ผล'], 'PUSH', 'สูง 3 ได้ 3 ลูก = คืนทุน');
  eq(g.stlOne_(b(-3), 2, 1)['ผล'], 'PUSH');
  eq(g.stlOne_(b(2.25), 1, 1)['ผล'], 'LOSS_HALF', 'สูง 2-2.5 ได้ 2 ลูก = เสียครึ่ง');
  eq(g.stlOne_(b(-2.25), 1, 1)['ผล'], 'WIN_HALF', 'ต่ำ 2-2.5 ได้ 2 ลูก = ได้ครึ่ง');
  eq(g.stlOne_(b(0), 0, 0)['ผล'], 'PUSH', 'เส้น 0 = สูง 0');
});

test('สูง/ต่ำ ไม่กรอกเส้น = null', () => {
  const g = env();
  eq(g.stlOne_(bet({ 'ตลาด':'OVER_UNDER', 'เส้น':'', 'แฮนดิแคป':'' }), 3, 1), null);
});

/* ---------- เสมอ / ทายสกอร์ ---------- */

test('แทงเสมอ', () => {
  const g = env();
  const b = bet({ 'ตลาด':'DRAW', 'แฮนดิแคป':'' });
  eq(g.stlOne_(b, 1, 1)['ผล'], 'WIN_FULL');
  eq(g.stlOne_(b, 2, 1)['ผล'], 'LOSS_FULL');
  eq(g.stlOne_(b, 0, 0)['ผล'], 'WIN_FULL');
});

test('ทายสกอร์ตรง — ต้องตรงทั้งฝั่งและถูกข้าง', () => {
  const g = env();
  const b = s => bet({ 'ตลาด':'CORRECT_SCORE', 'ทายสกอร์':s, 'แฮนดิแคป':'' });
  eq(g.stlOne_(b('2-1'), 2, 1)['ผล'], 'WIN_FULL');
  eq(g.stlOne_(b('2-1'), 1, 2)['ผล'], 'LOSS_FULL', 'สลับข้างไม่นับ');
  eq(g.stlOne_(b('2:1'), 2, 1)['ผล'], 'WIN_FULL', 'เขียนด้วย : ก็ได้');
  eq(g.stlOne_(b(''), 2, 1), null, 'ไม่ได้ทายไว้ = คิดไม่ได้');
  eq(g.stlOne_(b('สองต่อหนึ่ง'), 2, 1), null);
});

/* ---------- ด่านกันคิดมั่ว ---------- */

test('ยังไม่รู้สกอร์ = null', () => {
  const g = env();
  eq(g.stlOne_(bet(), '', ''), null);
  eq(g.stlOne_(bet(), 1, ''), null, 'รู้ข้างเดียวก็ไม่พอ');
  eq(g.stlOne_(bet(), 1.5, 0), null, 'สกอร์ต้องเป็นจำนวนเต็ม');
  eq(g.stlOne_(bet(), -1, 0), null);
});

test('ตลาดที่ระบบไม่รู้จัก = ไม่คิดให้', () => {
  const g = env();
  eq(g.stlOne_(bet({ 'ตลาด':'BTTS' }), 2, 1), null);
  eq(g.stlOne_(bet({ 'ตลาด':'' }), 2, 1), null);
});

test('ราคา/เงินไม่สมเหตุผล = ไม่คิด', () => {
  const g = env();
  eq(g.stlOne_(bet({ 'ราคา':1 }), 2, 1), null, 'ราคา 1 = ไม่มีกำไร ผิดแน่');
  eq(g.stlOne_(bet({ 'เงิน':0 }), 2, 1), null);
  eq(g.stlOne_(bet({ 'ราคา':'' }), 2, 1), null);
});

test('ผลที่คิดได้ ต้องมีครบทั้ง 5 ช่องที่จะเขียนลงชีต', () => {
  const g = env();
  const v = g.stlOne_(bet({ 'แฮนดิแคป':-0.5 }), 2, 1);
  eq(v, { 'สถานะ':'จบ', 'สกอร์เหย้า':2, 'สกอร์เยือน':1, 'ผล':'WIN_FULL', 'กำไร':234 });
});

/* ---------- เขียนลงชีต ---------- */

test('ใส่สกอร์แล้วบิลเปลี่ยนจากรอเตะเป็นจบ พร้อมกำไร', () => {
  const g = env(bookOf([bet({ 'ID':'B1', 'แฮนดิแคป':-0.5 })]));
  const out = g.stlWrite_('B1', 2, 1);
  eq(out['ลง'], 1);
  const r = g.readObjects_('BETS')[0];
  eq(r['สถานะ'], 'จบ');
  eq(r['ผล'], 'WIN_FULL');
  eq(r['กำไร'], 234);
  eq(Number(r['สกอร์เหย้า']), 2);
  eq(Number(r['สกอร์เยือน']), 1);
  ok(String(r['อัปเดตเมื่อ']).indexOf('2026-08-26') === 0, 'ต้องประทับเวลาที่แก้');
});

test('บิลย่อยลงผลพร้อมบิลแม่ (คู่เดียวกัน สกอร์เดียวกัน)', () => {
  const g = env(bookOf([
    bet({ 'ID':'B1', 'แฮนดิแคป':-0.5 }),
    bet({ 'ID':'B2', 'Parent_ID':'B1', 'Bill_Type':'SUB', 'ตลาด':'OVER_UNDER',
          'เส้น':2.5, 'แฮนดิแคป':'', 'ราคา':2, 'เงิน':100 })
  ]));
  const out = g.stlWrite_('B1', 2, 1);
  eq(out['ลง'], 2, 'ต้องลงทั้งใบแม่และใบย่อย');
  const rows = g.readObjects_('BETS');
  eq(rows[0]['ผล'], 'WIN_FULL');
  eq(rows[1]['ผล'], 'WIN_FULL', 'สูง 2.5 ได้ 3 ลูก');
  eq(rows[1]['กำไร'], 100);
});

test('ใบที่มีผลแล้วไม่ถูกเขียนทับ ถ้าไม่สั่ง force', () => {
  const g = env(bookOf([bet({ 'ID':'B1', 'ผล':'LOSS_FULL', 'กำไร':-300, 'สถานะ':'จบ' })]));
  const out = g.stlWrite_('B1', 2, 1);
  eq(out['ลง'], 0);
  eq(out['ข้าม'].length, 1);
  eq(g.readObjects_('BETS')[0]['ผล'], 'LOSS_FULL', 'ของเดิมต้องอยู่ครบ');

  const out2 = g.stlWrite_('B1', 2, 1, { force: true });
  eq(out2['ลง'], 1);
  eq(g.readObjects_('BETS')[0]['ผล'], 'WIN_FULL');
});

test('ใบที่คิดผลไม่ได้ = ข้ามใบนั้น ใบอื่นในคู่เดียวกันยังลงตามปกติ', () => {
  const g = env(bookOf([
    bet({ 'ID':'B1', 'แฮนดิแคป':-0.5 }),
    bet({ 'ID':'B2', 'Parent_ID':'B1', 'ตลาด':'BTTS', 'แฮนดิแคป':'' })
  ]));
  const out = g.stlWrite_('B1', 2, 1);
  eq(out['ลง'], 1);
  eq(out['ข้าม'], ['B2 (คิดผลไม่ได้)']);
  const rows = g.readObjects_('BETS');
  eq(rows[1]['ผล'], '', 'ใบที่คิดไม่ได้ต้องไม่ถูกแตะเลย');
  eq(rows[1]['สถานะ'], 'รอเตะ');
});

test('เขียนแล้วห้ามไปโดนช่องอื่นของแถว', () => {
  const g = env(bookOf([bet({ 'ID':'B1', 'แฮนดิแคป':-0.5, 'เงิน':300, 'ราคา':1.78,
                             'กุญแจกันซ้ำ':'KEY1', 'สร้างเมื่อ':'2026-08-25T10:00:00+07:00' })]));
  g.stlWrite_('B1', 2, 1);
  const r = g.readObjects_('BETS')[0];
  eq(Number(r['เงิน']), 300);
  eq(Number(r['ราคา']), 1.78);
  eq(r['กุญแจกันซ้ำ'], 'KEY1');
  eq(r['สร้างเมื่อ'], '2026-08-25T10:00:00+07:00');
  eq(r['ทีมที่เลือก'], 'Arsenal');
});

test('รหัสบิลที่ไม่มีในชีต = โยน error ไม่ใช่เงียบ', () => {
  const g = env(bookOf([bet({ 'ID':'B1' })]));
  throws(() => g.stlWrite_('B9', 2, 1), /ไม่มีบิลรหัส/);
  throws(() => g.stlWrite_('', 2, 1), /รหัสบิล/);
});

test('สกอร์ที่ส่งมาต้องเป็นจำนวนเต็ม', () => {
  const g = env(bookOf([bet({ 'ID':'B1' })]));
  throws(() => g.stlWrite_('B1', 'x', 1), /สกอร์/);
  throws(() => g.stlWrite_('B1', 1.5, 1), /สกอร์/);
  throws(() => g.stlWrite_('B1', '', ''), /สกอร์/);
});

test('สกอร์ที่ส่งมาเป็นข้อความก็ต้องรับได้ (มาจาก URL)', () => {
  const g = env(bookOf([bet({ 'ID':'B1', 'แฮนดิแคป':-0.5 })]));
  eq(g.stlWrite_('B1', '2', '1')['ลง'], 1);
  eq(g.readObjects_('BETS')[0]['ผล'], 'WIN_FULL');
});

/* ---------- ทางเรียกจาก URL ---------- */

function apiEnv(book, stubs) {
  return loadGas(['gas/Config.gs','gas/Sheets.gs','gas/Forebet.gs','gas/Live.gs',
                  'gas/Settle.gs','gas/Api.gs'], Object.assign({
    SpreadsheetApp: new FakeSpreadsheetApp(book || {}),
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => ({ SHEET_ID:'S', APP_KEY:'KK' }[k] || null), setProperty(){} }) },
    Utilities: { formatDate: () => '2026-08-26T10:00:00' },
    CacheService: { getScriptCache: () => ({ get: () => null, put(){} }) },
    UrlFetchApp: { fetch: () => { throw new Error('เทสต์ห้ามยิงเน็ต'); } },
    ContentService: { MimeType: { JSON: 'json' },
      createTextOutput: t => ({ _t:t, setMimeType(){ return this; }, getContent(){ return this._t; } }) }
  }, stubs || {}));
}
const get_ = (g, q) => JSON.parse(g.doGet({ parameter: q }).getContent());

test('?p=score ใส่สกอร์แล้วบิลจบ', () => {
  const g = apiEnv(bookOf([bet({ 'ID':'B1', 'แฮนดิแคป':-0.5 })]));
  const j = get_(g, { p:'score', k:'KK', id:'B1', h:'2', a:'1' });
  eq(j.ok, true);
  eq(j['ลง'], 1);
  eq(g.readObjects_('BETS')[0]['กำไร'], 234);
});

test('?p=score ไม่มีกุญแจ = ไม่ให้เขียน', () => {
  const g = apiEnv(bookOf([bet({ 'ID':'B1', 'แฮนดิแคป':-0.5 })]));
  const j = get_(g, { p:'score', id:'B1', h:'2', a:'1' });
  eq(j.needKey, true);
  eq(g.readObjects_('BETS')[0]['ผล'], '', 'ชีตต้องไม่ถูกแตะ');
});

test('?p=score รหัสผิด = ตอบ JSON บอกเหตุผล ไม่ใช่หน้า error', () => {
  const g = apiEnv(bookOf([bet({ 'ID':'B1' })]));
  const j = get_(g, { p:'score', k:'KK', id:'B9', h:'2', a:'1' });
  eq(j.ok, false);
  ok(/ไม่มีบิลรหัส/.test(j.error), 'ต้องบอกว่าไม่เจอบิล');
});

test('?p=score&force=1 เขียนทับผลเดิมได้', () => {
  const g = apiEnv(bookOf([bet({ 'ID':'B1', 'แฮนดิแคป':-0.5, 'ผล':'LOSS_FULL', 'กำไร':-300 })]));
  eq(get_(g, { p:'score', k:'KK', id:'B1', h:'2', a:'1' })['ลง'], 0);
  eq(get_(g, { p:'score', k:'KK', id:'B1', h:'2', a:'1', force:'1' })['ลง'], 1);
  eq(g.readObjects_('BETS')[0]['ผล'], 'WIN_FULL');
});

test('?p=settle เรียกได้ และไม่พังเมื่อยังไม่มีบิลถึงคิว', () => {
  const g = apiEnv(bookOf([bet({ 'ID':'B1', 'เวลาเตะ':'2099-01-01T20:00:00+07:00' })]));
  const j = get_(g, { p:'settle', k:'KK' });
  eq(j['ตรวจ'], 0);
  eq(g.readObjects_('BETS')[0]['ผล'], '');
});

test('?p=all ที่ตัวคิดผลพัง ต้องยังส่งหน้าเว็บได้', () => {
  const g = apiEnv(bookOf([bet({ 'ID':'B1' })]),
    { CacheService: { getScriptCache: () => { throw new Error('แคชล่ม'); } } });
  const j = get_(g, { p:'all', k:'KK' });
  eq(j.ok, true, 'หน้าเว็บต้องไม่ล้มตามตัวคิดผล');
});

/* ---------- ตัวไล่คิดผลเอง ---------- */

/* เวลาเตะจริง 2026-08-25 21:45 ไทย = 14:45 UTC · เอามาบวกเองในเทสต์จะได้ไม่ต้องเดา */
const KICK = '2026-08-25T21:45:00+07:00';
const AFTER = Date.parse(KICK) + 120 * 60000;   // จบเกมแล้ว
const DURING = Date.parse(KICK) + 60 * 60000;   // ยังเตะอยู่

function autoEnv(bets, score) {
  const g = env(bookOf(bets));
  g.lsScoreOf_ = () => score;
  return g;
}

test('บิลที่เตะจบแล้วและหาสกอร์เจอ = ลงผลเอง', () => {
  const g = autoEnv([bet({ 'ID':'B1', 'แฮนดิแคป':-0.5, 'เวลาเตะ':KICK })], { hs:2, as:1 });
  const out = g.stlAutoRun_(AFTER);
  eq(out['ลง'], 1);
  eq(g.readObjects_('BETS')[0]['ผล'], 'WIN_FULL');
});

test('ยังไม่ถึงเวลาที่เกมน่าจะจบ = ไม่แตะ', () => {
  const g = autoEnv([bet({ 'ID':'B1', 'เวลาเตะ':KICK })], { hs:2, as:1 });
  eq(g.stlAutoRun_(DURING)['ตรวจ'], 0);
  eq(g.readObjects_('BETS')[0]['ผล'], '');
});

test('หาสกอร์ไม่เจอ = นับเป็นยังไม่จบ ไม่ใช่เดา 0-0', () => {
  const g = autoEnv([bet({ 'ID':'B1', 'เวลาเตะ':KICK })], null);
  const out = g.stlAutoRun_(AFTER);
  eq(out['ยังไม่จบ'], 1);
  eq(out['ลง'], 0);
  eq(g.readObjects_('BETS')[0]['ผล'], '');
});

test('ฟีดล่ม = ไม่ล้มทั้งรอบ บิลอื่นยังไปต่อ', () => {
  const g = env(bookOf([
    bet({ 'ID':'B1', 'เวลาเตะ':KICK }),
    bet({ 'ID':'B2', 'แฮนดิแคป':-0.5, 'เวลาเตะ':KICK, 'ทีมเหย้า':'Spurs', 'ทีมที่เลือก':'Spurs' })
  ]));
  let n = 0;
  g.lsScoreOf_ = () => { n++; if (n === 1) throw new Error('ฟีดล่ม'); return { hs:2, as:1 }; };
  const out = g.stlAutoRun_(AFTER);
  eq(out['ลง'], 1);
  eq(out['ยังไม่จบ'], 1);
});

test('บิลที่มีผลแล้ว / บิลย่อย ไม่ถูกหยิบมาตรวจซ้ำ', () => {
  const g = autoEnv([
    bet({ 'ID':'B1', 'เวลาเตะ':KICK, 'ผล':'WIN_FULL' }),
    bet({ 'ID':'B2', 'Parent_ID':'B1', 'เวลาเตะ':KICK })
  ], { hs:2, as:1 });
  eq(g.stlAutoRun_(AFTER)['ตรวจ'], 0);
});

test('ไม่มีเวลาเตะ = ข้าม (ไม่รู้ว่าจบหรือยัง)', () => {
  const g = autoEnv([bet({ 'ID':'B1', 'เวลาเตะ':'' })], { hs:2, as:1 });
  eq(g.stlAutoRun_(AFTER)['ตรวจ'], 0);
});

test('ตัวหน่วง 10 นาที: กดรัวแล้วรอบสองต้องไม่ทำงาน', () => {
  const bets = [bet({ 'ID':'B1', 'แฮนดิแคป':-0.5, 'เวลาเตะ':KICK })];
  let store = null;
  const g = env(bookOf(bets), { CacheService: { getScriptCache: () => ({
    get: () => store, put: (k, v) => { store = v; } }) } });
  g.lsScoreOf_ = () => ({ hs:2, as:1 });
  ok(g.stlAutoTick_(AFTER), 'รอบแรกต้องทำงาน');
  eq(g.stlAutoTick_(AFTER + 60000), null, 'รอบสองในนาทีเดียวกันต้องไม่ทำ');
  ok(g.stlAutoTick_(AFTER + 11 * 60000), 'พ้น 10 นาทีแล้วทำได้');
});
