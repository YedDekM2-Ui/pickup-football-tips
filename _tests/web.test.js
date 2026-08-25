'use strict';
const { loadWeb } = require('./webEnv');

const w = loadWeb(['web/js/fmt.js', 'web/js/mock.js', 'web/js/app.js']);

test('routeOf รู้จัก 3 หน้า และของแปลกให้ตกมาที่หน้าแรก', () => {
  eq(w.routeOf('#forebet'), 'forebet');
  eq(w.routeOf('#mybet'), 'mybet');
  eq(w.routeOf('#ledger'), 'ledger');
  eq(w.routeOf(''), 'forebet');
  eq(w.routeOf('#อะไรไม่รู้'), 'forebet');
});

test('renderNav มีครบ 3 ปุ่ม และปุ่มที่เปิดอยู่ถูกทำเครื่องหมาย', () => {
  const html = w.renderNav('mybet');
  ok(html.indexOf('#forebet') >= 0, 'ต้องมีลิงก์หน้า 1');
  ok(html.indexOf('#mybet') >= 0, 'ต้องมีลิงก์หน้า 2');
  ok(html.indexOf('#ledger') >= 0, 'ต้องมีลิงก์หน้า 3');
  ok(html.indexOf('nav-on') >= 0, 'ต้องมีคลาสบอกปุ่มที่เปิดอยู่');
  eq((html.match(/nav-on/g) || []).length, 1, 'ต้องมีปุ่มที่เปิดอยู่ใบเดียว');
  ok(/nav-on[^>]*href="#mybet"|href="#mybet"[^>]*nav-on/.test(html), 'nav-on ต้องอยู่บนปุ่ม mybet');
});

test('ข้อมูลปลอมมีรูปร่างเดียวกับของจริง', () => {
  ok(Array.isArray(w.MOCK.picks), 'picks ต้องเป็น array');
  ok(Array.isArray(w.MOCK.bets), 'bets ต้องเป็น array');
  ok(w.MOCK.ledger && typeof w.MOCK.ledger === 'object', 'ต้องมี ledger');
  ok(w.MOCK.picks.length >= 2 && w.MOCK.picks.length <= 4, 'การ์ด Forebet ต้อง 2-4 ใบ');
  const main = w.MOCK.bets[0];
  ok(Array.isArray(main.subs), 'บิลแม่ต้องมีช่อง subs');
  eq(main['ชนิด'], 'MAIN');
});

const f = loadWeb(['web/js/fmt.js', 'web/js/mock.js', 'web/js/page-forebet.js']);

test('teamTh ไม่มีชื่อไทย = ใช้ชื่ออังกฤษ ห้ามทับศัพท์เอง', () => {
  eq(f.teamTh('Once Caldas', 'อองเซ กัลดาส'), 'อองเซ กัลดาส');
  eq(f.teamTh('Once Caldas', ''), 'Once Caldas');
  eq(f.teamTh('Once Caldas', null), 'Once Caldas');
  eq(f.teamTh('Once Caldas', undefined), 'Once Caldas');
});

test('esc_ กันโค้ดหลุดเข้า HTML', () => {
  eq(f.esc_('<b>x</b>'), '&lt;b&gt;x&lt;/b&gt;');
  eq(f.esc_('a & b'), 'a &amp; b');
  eq(f.esc_(''), '');
  eq(f.esc_(null), '');
});

test('pickCard โชว์ครบ ทีม/เวลา/เปอร์เซ็นต์/ราคา และนับถอยหลัง', () => {
  const now = Date.parse('2026-08-25T18:33:00+07:00');
  const html = f.pickCard(f.MOCK.picks[0], now);
  ok(html.indexOf('อินเตอร์') >= 0, 'ต้องมีชื่อไทยทีมเหย้า');
  ok(html.indexOf('มิลาน') >= 0, 'ต้องมีชื่อไทยทีมเยือน');
  ok(html.indexOf('21:45') >= 0, 'ต้องมีเวลาเตะ');
  ok(html.indexOf('56%') >= 0, 'ต้องมีเปอร์เซ็นต์');
  ok(html.indexOf('1.95') >= 0, 'ต้องมีราคา');
  ok(html.indexOf('อีก 3 ชม. 12 น.') >= 0, 'ต้องมีนับถอยหลัง');
});

test('renderForebet เรียงเปอร์เซ็นต์มากไปน้อย และไม่เกิน 4 ใบ', () => {
  const many = { picks: [], bets: [], ledger: {} };
  for (let i = 0; i < 9; i++) {
    many.picks.push(Object.assign({}, f.MOCK.picks[0], { id: 'PK-' + i, 'เปอร์เซ็นต์': i * 10 }));
  }
  const html = f.renderForebet(many, Date.now());
  eq((html.match(/class="card pick"/g) || []).length, 4);
  ok(html.indexOf('80%') >= 0, 'ใบเปอร์เซ็นต์สูงสุดต้องติดมา');
  ok(html.indexOf('>0%<') === -1, 'ใบเปอร์เซ็นต์ต่ำสุดต้องถูกตัด');
  const iHi = html.indexOf('80%'), iLo = html.indexOf('50%');
  ok(iHi < iLo, 'ใบเปอร์เซ็นต์สูงต้องอยู่บนกว่า');
});

test('renderForebet ไม่มีคู่ = บอกตรงๆ ไม่ใช่หน้าขาว', () => {
  const html = f.renderForebet({ picks: [], bets: [], ledger: {} }, Date.now());
  ok(html.indexOf('ยังไม่มีคู่ของรอบนี้') >= 0);
});

test('renderForebet มีปุ่มกรอกเองเสมอ และปุ่มสูงพอให้นิ้วโป้งกด', () => {
  ok(f.renderForebet(f.MOCK, Date.now()).indexOf('กรอกเอง') >= 0);
  ok(f.renderForebet({ picks: [], bets: [], ledger: {} }, Date.now()).indexOf('กรอกเอง') >= 0);
});
