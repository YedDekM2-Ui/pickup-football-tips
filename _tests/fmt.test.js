'use strict';
const { loadWeb } = require('./webEnv');

const w = loadWeb(['web/js/fmt.js']);

test('fmtMoney ใส่คอมมาและทศนิยม 2 ตำแหน่งเสมอ', () => {
  eq(w.fmtMoney(1234.5), '1,234.50');
  eq(w.fmtMoney(300), '300.00');
  eq(w.fmtMoney(-150), '-150.00');
  eq(w.fmtMoney(0), '0.00');
});

test('fmtSigned ใส่เครื่องหมายบวกให้กำไร', () => {
  eq(w.fmtSigned(234), '+234.00');
  eq(w.fmtSigned(-150), '-150.00');
  eq(w.fmtSigned(0), '0.00');
});

test('fmtHandicap ศูนย์ไม่มีเครื่องหมาย ที่เหลือมีเสมอ', () => {
  eq(w.fmtHandicap(0), '0');
  eq(w.fmtHandicap(0.5), '+0.5');
  eq(w.fmtHandicap(-0.25), '-0.25');
  eq(w.fmtHandicap(1), '+1');
  eq(w.fmtHandicap(-1.25), '-1.25');
});

test('fmtOdds ห้ามปัดทศนิยมที่สลิปให้มา', () => {
  eq(w.fmtOdds(1.9), '1.90');
  eq(w.fmtOdds(1.95), '1.95');
  eq(w.fmtOdds(6.161), '6.161');
  eq(w.fmtOdds(10), '10.00');
});

test('thDate อ่านเป็นเวลาไทยเสมอ ไม่พึ่ง timezone ของเครื่อง', () => {
  eq(w.thDate('2026-08-25T21:45:00+07:00'), '25 ส.ค. 69');
  // 2026-08-25T18:30Z = 26 ส.ค. 01:30 ตามเวลาไทย → ต้องข้ามวัน
  eq(w.thDate('2026-08-25T18:30:00Z'), '26 ส.ค. 69');
});

test('thTime อ่านเป็นเวลาไทยเสมอ', () => {
  eq(w.thTime('2026-08-25T21:45:00+07:00'), '21:45');
  eq(w.thTime('2026-08-25T18:30:00Z'), '01:30');
});

test('countdownText ยังไม่เตะ = นับถอยหลัง', () => {
  const kick = '2026-08-25T21:45:00+07:00';
  const now = Date.parse('2026-08-25T18:33:00+07:00');
  eq(w.countdownText(kick, 'รอเตะ', now), 'อีก 3 ชม. 12 น.');
});

test('countdownText เหลือไม่ถึงชั่วโมง = บอกเป็นนาที', () => {
  const kick = '2026-08-25T21:45:00+07:00';
  const now = Date.parse('2026-08-25T21:20:00+07:00');
  eq(w.countdownText(kick, 'รอเตะ', now), 'อีก 25 น.');
});

test('countdownText เตะไปแล้วห้ามติดลบ', () => {
  const kick = '2026-08-25T21:45:00+07:00';
  const now = Date.parse('2026-08-25T22:30:00+07:00');
  eq(w.countdownText(kick, 'รอเตะ', now), 'สด');
  eq(w.countdownText(kick, 'สด', now), 'สด');
});

test('countdownText จบแล้วขึ้นจบ ไม่ว่าเวลาจะเป็นเท่าไหร่', () => {
  const kick = '2026-08-25T21:45:00+07:00';
  eq(w.countdownText(kick, 'จบ', Date.parse('2026-08-25T18:00:00+07:00')), 'จบการแข่งขัน');
  eq(w.countdownText(kick, 'จบ', Date.parse('2026-08-26T09:00:00+07:00')), 'จบการแข่งขัน');
});

test('เวลาที่อ่านไม่ได้ ต้องไม่ทำให้พัง', () => {
  eq(w.thDate(''), '');
  eq(w.thTime('อะไรไม่รู้'), '');
  eq(w.countdownText('', 'รอเตะ', Date.now()), '');
});
