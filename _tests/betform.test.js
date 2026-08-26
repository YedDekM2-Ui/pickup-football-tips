/* betform.test.js — เลือกคู่จากหน้าแรก แทนการนั่งพิมพ์ซ้ำ

   เจ้าของ: "กุลงบิลไปแล้วให้กุมานั่งกรอกส่วนอื่นอีกเนี่ยนะ"
   ลีก/ทีมเหย้า/ทีมเยือน/วันที่/เวลา แอปรู้อยู่แล้วจากหน้าแรก
   เหลือให้กรอกเองแค่ ตลาด/ราคา/เงิน ซึ่งมีอยู่ในบิลเท่านั้น หน้าแรกไม่มีทางรู้
*/

const { loadWeb } = require('./webEnv');

const w = loadWeb(['web/js/fmt.js', 'web/js/page-forebet.js', 'web/js/page-mybet.js']);

function reset() { w.BETFORM.open = false; w.BETFORM.busy = false; w.BETFORM.msg = ''; w.BETFORM.v = {}; }

const P_FEAT = { 'ลีก': 'Champions League Women', 'เหย้า': 'Czarni Sosnowiec W',
  'เยือน': 'OH Leuven W', 'วันที่': '2026-08-27', 'เวลาเตะ': '00:00' };
const P_ONE = { 'ลีก': 'Premier League', 'เหย้า': 'Arsenal', 'เหย้าไทย': 'อาร์เซนอล',
  'เยือน': 'Leeds', 'วันที่': '2026-08-27', 'เวลาเตะ': '21:30' };
const P_TWO = { 'ลีก': 'Serie A', 'เหย้า': 'Inter', 'เยือน': 'Roma',
  'วันที่': '2026-08-27', 'เวลาเตะ': '01:45' };

test('รายการคู่: ปักหมุดขึ้นก่อน · คู่ซ้ำเอาใบเดียว · ขาดชื่อทีมไม่เอา', () => {
  const list = w.betPickList_({
    pinned: [P_FEAT],
    picks: [P_ONE, P_FEAT, P_TWO,
      { 'เหย้า': 'Milan', 'เยือน': '' },      /* ขาดทีมเยือน */
      { 'เยือน': 'Lazio' }]                    /* ขาดทีมเหย้า */
  });
  eq(list.length, 3, 'เหลือ 3 คู่ที่เลือกได้จริง');
  eq(list[0]['เหย้า'], 'Czarni Sosnowiec W', 'คู่ปักหมุดต้องอยู่บนสุด เลือกง่ายสุด');
  eq(list[1]['เหย้า'], 'Arsenal');
  eq(list[2]['เหย้า'], 'Inter');
});

test('คู่เดียวกันคนละวัน = คนละคู่ (เจอกันสองนัดในทัวร์เดียว)', () => {
  const a = { 'เหย้า': 'Arsenal', 'เยือน': 'Leeds', 'วันที่': '2026-08-27' };
  const b = { 'เหย้า': 'Arsenal', 'เยือน': 'Leeds', 'วันที่': '2026-09-03' };
  eq(w.betPickList_({ picks: [a, b] }).length, 2);
});

test('ไม่มีข้อมูลมาเลย = รายการว่าง ไม่พัง', () => {
  eq(w.betPickList_(null).length, 0);
  eq(w.betPickList_({}).length, 0);
  eq(w.betPickList_({ pinned: [], picks: [] }).length, 0);
});

test('ป้ายในช่องเลือก: ชื่อไทยก่อน + เวลาเตะต่อท้าย', () => {
  eq(w.betPickLabel_(P_ONE), 'อาร์เซนอล VS Leeds · 21:30', 'แปลไม่เจอก็โชว์อังกฤษเดิม');
  eq(w.betPickLabel_({ 'เหย้า': 'Inter', 'เยือน': 'Roma' }), 'Inter VS Roma',
     'ไม่มีเวลาเตะ = ไม่ต้องมีจุดคั่นค้างไว้');
});

test('เลือกคู่ทีเดียว 5 ช่องเต็ม — ที่เหลือคือของที่มีแต่ในบิล ห้ามเดาให้', () => {
  reset();
  w.betFormHtml({ pinned: [P_FEAT], picks: [P_ONE] });
  w.betFormPick(0);

  eq(w.BETFORM.v['ลีก'], 'Champions League Women');
  eq(w.BETFORM.v['ทีมเหย้า'], 'Czarni Sosnowiec W');
  eq(w.BETFORM.v['ทีมเยือน'], 'OH Leuven W');
  eq(w.BETFORM.v['วันที่'], '2026-08-27');
  eq(w.BETFORM.v['เวลา'], '00:00');
  eq(Object.keys(w.BETFORM.v).length, 5, 'ต้องกรอกแค่ 5 ช่องนี้ ห้ามแตะช่องอื่น');
  ok(w.BETFORM.msg.indexOf('ตลาด/ราคา/เงิน') >= 0, 'ต้องบอกว่าเหลืออะไรให้กรอกเอง');
});

test('ของที่กรอกไว้แล้วเรื่องเงิน ห้ามหายตอนเลือกคู่', () => {
  reset();
  w.betFormSet('ราคา', '1.90');
  w.betFormSet('เงิน', '100');
  w.betFormSet('ตลาด', 'AH');
  w.betFormHtml({ picks: [P_ONE] });
  w.betFormPick(0);

  eq(w.BETFORM.v['ราคา'], '1.90');
  eq(w.BETFORM.v['เงิน'], '100');
  eq(w.BETFORM.v['ตลาด'], 'AH');
  eq(w.BETFORM.v['ทีมเหย้า'], 'Arsenal', 'คู่ก็ต้องกรอกให้ด้วย');
});

test('เลือกคู่ใหม่ทับคู่เก่าได้ (กดเลือกใหม่ = ตั้งใจเปลี่ยน)', () => {
  reset();
  w.betFormHtml({ picks: [P_ONE, P_TWO] });
  w.betFormPick(0);
  w.betFormPick(1);
  eq(w.BETFORM.v['ทีมเหย้า'], 'Inter');
  eq(w.BETFORM.v['เวลา'], '01:45');
});

test('กดช่องว่าง / เลขมั่ว = ไม่ทำอะไรเลย ไม่ล้างของที่กรอกไว้', () => {
  reset();
  w.betFormHtml({ picks: [P_ONE] });
  w.betFormPick(0);
  w.betFormPick('');       /* บรรทัด "— เลือกคู่จากหน้าแรก —" */
  w.betFormPick(99);
  eq(w.BETFORM.v['ทีมเหย้า'], 'Arsenal', 'ของเดิมต้องอยู่ครบ');
});

test('ช่องเลือกคู่ต้องโผล่ในฟอร์มจริง และหายไปเมื่อไม่มีคู่ให้เลือก', () => {
  reset();
  w.BETFORM.open = true;

  const on = w.betFormHtml({ pinned: [P_FEAT], picks: [P_ONE] });
  ok(on.indexOf('betFormPick(this.value)') >= 0, 'ต้องต่อสายกับตัวกรอกให้');
  ok(on.indexOf('Czarni Sosnowiec W VS OH Leuven W · 00:00') >= 0, 'ต้องเห็นคู่ปักหมุดในช่อง');
  ok(on.indexOf('อาร์เซนอล VS Leeds · 21:30') >= 0);
  ok(on.indexOf('🖼 เลือกรูปบิลจากอัลบั้ม') >= 0, 'ปุ่มอัลบั้มเดิมต้องยังอยู่ ห้ามทำตกหล่น');
  ok(on.indexOf('capture') < 0, 'ห้ามมีกล้อง — เจ้าของอัพจากอัลบั้มอย่างเดียว');

  const off = w.betFormHtml({ pinned: [], picks: [] });
  eq(off.indexOf('betFormPick'), -1, 'ไม่มีคู่ = ไม่ต้องมีช่องเปล่าให้รก');
  ok(off.indexOf('บันทึกบิล') >= 0, 'ฟอร์มที่เหลือต้องยังใช้ได้');

  w.BETFORM.open = false;
  const bar = w.betFormHtml({ picks: [P_ONE] });
  ok(bar.indexOf('＋ ลงบิล') >= 0, 'ยังไม่กดเปิด = เห็นแค่ปุ่มเหมือนเดิม');
  eq(bar.indexOf('betFormPick'), -1);
  reset();
});

test('renderMyBet ส่งคู่จากหน้าแรกเข้าฟอร์มให้จริง (ไม่ใช่แค่ฟังก์ชันลอยๆ)', () => {
  reset();
  w.BETFORM.open = true;
  const html = w.renderMyBet({ pinned: [P_FEAT], picks: [P_ONE], bets: [] }, Date.now());
  ok(html.indexOf('betFormPick(this.value)') >= 0, 'ช่องเลือกคู่ต้องอยู่ในหน้าที่วาดจริง');
  ok(html.indexOf('Czarni Sosnowiec W VS OH Leuven W') >= 0);
  reset();
});
