// _tests/lotdue.test.js — ด่าน "หวยยังไม่ออก อย่าเพิ่งถาม"
'use strict';
const { loadGas } = require('./gasEnv');

/** โหลด LotDue พร้อมนาฬิกาปลอม และชีตปลอม (ส่ง hour = null คือ นาฬิกาพัง) */
function env(hour, recorded) {
  const fmt = (d, tz, f) => {
    if (hour === null) throw new Error('นาฬิกาพัง');
    if (String(f) === 'H') return String(hour);
    return '';
  };
  const s = loadGas(['gas/LotCal.gs', 'gas/LotDue.gs'], {
    TZ: 'Asia/Bangkok',
    LAO: { ASK_HOUR: 21, SHEET: 'Lao_Lottery', HEADERS: ['dateISO'], PROP_PENDING: 'LAO_PENDING' },
    THAI_LOT: { ASK_HOUR: 16, SHEET: 'Thai_Lottery', HEADERS: ['dateISO'], PROP_PENDING: 'THAI_PENDING' },
    Utilities: { formatDate: fmt }
  });
  s.lotRecordedISO_ = () => (recorded || {});
  return s;
}

test('lotDrawnYet_ — ก่อน 21:00 ถือว่าหวยลาวยังไม่ออก', () => {
  eq(env(6).lotDrawnYet_('lao'), false);
  eq(env(20).lotDrawnYet_('lao'), false);
  eq(env(21).lotDrawnYet_('lao'), true);
});

test('lotDrawnYet_ — หวยไทยใช้ 16:00 คนละเส้นกับลาว', () => {
  eq(env(15).lotDrawnYet_('thai'), false);
  eq(env(16).lotDrawnYet_('thai'), true);
  eq(env(16).lotDrawnYet_('lao'), false);
});

test('นาฬิกาพัง = ถือว่าออกแล้ว (ห้ามเงียบถาวร)', () => {
  eq(env(null).lotDrawnYet_('lao'), true);
});

test('lotDueDraws_ — เช้าวันศุกร์ ยังไม่ถือว่างวดวันนี้ค้าง', () => {
  const due = env(6).lotDueDraws_('lao', '2026-09-04');
  eq(due.indexOf('2026-09-04'), -1);
  ok(due.length > 0, 'งวดเก่าต้องยังอยู่');
});

test('lotDueDraws_ — หลัง 21:00 งวดวันนี้ค้างจริง', () => {
  const due = env(21).lotDueDraws_('lao', '2026-09-04');
  eq(due[due.length - 1], '2026-09-04');
});

test('lotDueDraws_ — จดไว้แล้วก็ไม่ถามซ้ำ', () => {
  const due = env(21, { '2026-09-04': true }).lotDueDraws_('lao', '2026-09-04');
  eq(due.indexOf('2026-09-04'), -1);
});

test('lotDueDraws_ — งวดเก่าที่ค้างไม่โดนด่านชั่วโมง', () => {
  const due = env(6).lotDueDraws_('lao', '2026-09-04', 2);
  eq(due, ['2026-09-02', '2026-09-03']);
});
