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
  ok(html.indexOf('VS') >= 0, 'คู่บอลใช้คำว่า VS');
  eq(html.indexOf('พบ'), -1, 'ไม่ใช้คำว่า พบ แล้ว');
});

test('pickCard โชว์ 1X2 กับสกอร์ที่เดา', () => {
  const now = Date.parse('2026-08-25T18:33:00+07:00');
  const h1 = f.pickCard(f.MOCK.picks[0], now);          // เดาผล 1 = เหย้า
  ok(h1.indexOf('เต็ง อินเตอร์') >= 0, '1 = เต็งเจ้าบ้าน');
  ok(h1.indexOf('เดาสกอร์ 2-1') >= 0, 'ต้องมีสกอร์ที่เดา');

  const h2 = f.pickCard(f.MOCK.picks[1], now);          // เดาผล X = เสมอ
  ok(h2.indexOf('เสมอ') >= 0, 'X = เสมอ');
  ok(h2.indexOf('เดาสกอร์ 1-1') >= 0, 'ต้องมีสกอร์ที่เดา');

  const away = Object.assign({}, f.MOCK.picks[0], { 'เดาผล': '2' });
  ok(f.pickCard(away, now).indexOf('เต็ง มิลาน') >= 0, '2 = เต็งทีมเยือน');
});

test('ไม่มี 1X2/สกอร์ที่เดา = ไม่ขึ้นบรรทัดเปล่า', () => {
  const now = Date.parse('2026-08-25T18:33:00+07:00');
  const bare = Object.assign({}, f.MOCK.picks[0], { 'เดาผล': '', 'เดาสกอร์': '' });
  const html = f.pickCard(bare, now);
  eq(html.indexOf('pick-pred'), -1, 'ไม่มีข้อมูลก็ไม่ต้องมีบรรทัด');
  eq(html.indexOf('เดาสกอร์'), -1, 'ห้ามมีป้ายลอย');
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

test('pinCard บอกว่าเป็นช่องไหน และดึงมาเมื่อไหร่', () => {
  const html = f.pinCard(f.MOCK.pinned[0], Date.now());
  ok(html.indexOf('FEATURED MATCH') >= 0, 'ต้องมีป้ายช่อง');
  ok(html.indexOf('อาร์เซนอล') >= 0, 'ต้องมีชื่อทีมไทย');
  ok(html.indexOf('เต็ง อาร์เซนอล') >= 0, 'ต้องมี 1X2');
  ok(html.indexOf('เดาสกอร์ 2-0') >= 0, 'ต้องมีสกอร์ที่เดา');
  ok(html.indexOf('ดึงมาเมื่อ') >= 0, 'ภาพนิ่งต้องบอกเวลาที่ดึง');
  ok(html.indexOf('12:00') >= 0, 'ต้องมีเวลาที่ดึงจริง');
  eq(f.pinCard(f.MOCK.pinned[1], Date.now()).indexOf('PICK OF THE DAY') >= 0, true);
});

test('ไม่รู้เวลาเตะ = ไม่โชว์บรรทัดนับถอยหลังมั่ว', () => {
  const html = f.pinCard(f.MOCK.pinned[0], Date.now());
  eq(html.indexOf('รอเตะ'), -1, 'ไม่มีเวลาเตะก็ห้ามเดา');
  eq(html.indexOf('อีก '), -1, 'ห้ามนับถอยหลังจากเวลาว่าง');
});

test('renderForebet ปักหมุดไว้บนสุด และไม่โผล่ซ้ำในลิสต์ปกติ', () => {
  const html = f.renderForebet(f.MOCK, Date.now());
  eq((html.match(/class="card pick pin"/g) || []).length, 2, 'ปักหมุด 2 ใบ');
  eq((html.match(/Premier League/g) || []).length, 1, 'คู่ปักหมุดต้องโผล่ใบเดียว');
  const iPin = html.indexOf('FEATURED MATCH'), iNorm = html.indexOf('อินเตอร์');
  ok(iPin >= 0 && iNorm >= 0 && iPin < iNorm, 'ใบปักหมุดต้องอยู่บนใบปกติ');
});

test('ไม่มีคู่ปักหมุด = หน้าเดิมไม่พัง', () => {
  const noPin = Object.assign({}, f.MOCK, { pinned: [] });
  const html = f.renderForebet(noPin, Date.now());
  eq(html.indexOf('card pick pin'), -1, 'ไม่มีก็ไม่ต้องมีกรอบเปล่า');
  ok(html.indexOf('อินเตอร์') >= 0, 'ใบปกติต้องยังอยู่');
  ok(f.renderForebet({ picks: [] }, Date.now()).indexOf('ยังไม่มีคู่ของรอบนี้') >= 0);
});

const wm = loadWeb(['web/js/fmt.js', 'web/js/mock.js',
                    'web/js/page-forebet.js', 'web/js/page-mybet.js']);

test('resultBadge ครบ 5 ผล + ยังไม่รู้ผล', () => {
  ok(wm.resultBadge('WIN_FULL').indexOf('ชนะเต็ม') >= 0);
  ok(wm.resultBadge('WIN_HALF').indexOf('ชนะครึ่ง') >= 0);
  ok(wm.resultBadge('PUSH').indexOf('คืนทุน') >= 0);
  ok(wm.resultBadge('LOSS_HALF').indexOf('แพ้ครึ่ง') >= 0);
  ok(wm.resultBadge('LOSS_FULL').indexOf('แพ้เต็ม') >= 0);
  ok(wm.resultBadge('').indexOf('รอผล') >= 0);
  const classes = ['WIN_FULL','WIN_HALF','PUSH','LOSS_HALF','LOSS_FULL','']
    .map(c => (wm.resultBadge(c).match(/r-[a-z]+/) || [''])[0]);
  eq(new Set(classes).size, 6, 'ทั้ง 6 แบบต้องคนละสี');
});

test('marketLine เขียนแต่ละตลาดเป็นภาษาคน', () => {
  eq(wm.marketLine({ 'ตลาด':'AH', 'ทีมที่เลือก':'Milan', 'ทีมที่เลือกไทย':'มิลาน', 'แฮนดิแคป':0.25 }),
     'มิลาน +0.25');
  eq(wm.marketLine({ 'ตลาด':'OVER_UNDER', 'เส้น':1.5 }), 'สูง 1.5');
  eq(wm.marketLine({ 'ตลาด':'OVER_UNDER', 'เส้น':-2.5 }), 'ต่ำ 2.5');
  eq(wm.marketLine({ 'ตลาด':'DRAW' }), 'เสมอ');
  eq(wm.marketLine({ 'ตลาด':'CORRECT_SCORE', 'ทายสกอร์':'2-1' }), 'สกอร์ตรง 2-1');
});

test('betSlip โชว์ ราคา ผล กำไร และบิลย่อยครบ', () => {
  const html = wm.betSlip(wm.MOCK.bets[0], Date.now());
  ok(html.indexOf('อองเซ กัลดาส') >= 0, 'ต้องมีทีมที่เลือก');
  ok(html.indexOf('+0.5') >= 0, 'ต้องมีแฮนดิแคป');
  ok(html.indexOf('1.95') >= 0, 'ต้องมีราคา');
  ok(html.indexOf('ชนะเต็ม') >= 0, 'ต้องมีผล');
  ok(html.indexOf('สูง 1.5') >= 0, 'ต้องมีบิลย่อยใบที่ 1');
  ok(html.indexOf('เสมอ') >= 0, 'ต้องมีบิลย่อยใบที่ 2');
  ok(html.indexOf('6.161') >= 0, 'ราคาบิลย่อยห้ามปัด');
  ok(html.indexOf('+615.05') >= 0, 'ต้องมียอดรวมกำไรทั้งคู่');
  ok(html.indexOf('VS') >= 0, 'คู่บอลใช้คำว่า VS');
});

test('หน้า 2 ห้ามโชว์ยอดเงินที่แทง (เรื่องเงินอยู่หน้า 3)', () => {
  const html = wm.betSlip(wm.MOCK.bets[0], Date.now());
  eq(html.indexOf('300.00'), -1, 'ห้ามโชว์เงินใบหลัก');
  eq(html.indexOf('100.00'), -1, 'ห้ามโชว์เงินบิลย่อยใบที่ 1');
  eq(html.indexOf('50.00'), -1, 'ห้ามโชว์เงินบิลย่อยใบที่ 2');
  eq(html.indexOf('450.00'), -1, 'ห้ามโชว์ยอดเงินรวม');
});

test('หน้า 2 ห้ามหลุดของต้องห้าม (กฎเหล็กสเปกข้อ 10)', () => {
  const dirty = Object.assign({}, wm.MOCK.bets[0], {
    'เปอร์เซ็นต์': 56,
    'เดาสกอร์': '2-1',
    'บทวิเคราะห์': 'Forebet บอกว่าเจ้าบ้านฟอร์มดี',
    'Telegram_Message_ID': 9911,
    'กุญแจกันซ้ำ': 'KEY-XYZ'
  });
  const html = wm.betSlip(dirty, Date.now());
  eq(html.indexOf('BT-1'), -1, 'ห้ามโชว์ Bet ID');
  eq(html.indexOf('56%'), -1, 'ห้ามโชว์เปอร์เซ็นต์');
  eq(html.indexOf('2-1'), -1, 'ห้ามโชว์สกอร์ที่ Forebet เดา');
  eq(html.indexOf('Forebet'), -1, 'ห้ามโชว์บทวิเคราะห์');
  eq(html.indexOf('9911'), -1, 'ห้ามโชว์เลขข้อความเทเลแกรม');
  eq(html.indexOf('KEY-XYZ'), -1, 'ห้ามโชว์กุญแจกันซ้ำ');
});

test('betSlip ห้ามโชว์แฮนดิแคปของฝั่งตรงข้าม', () => {
  const b = Object.assign({}, wm.MOCK.bets[1]);
  b['แฮนดิแคป'] = 0.5;
  const html = wm.betSlip(b, Date.now());
  ok(html.indexOf('+0.5') >= 0, 'ต้องมีแฮนดิแคปฝั่งที่เลือก');
  eq(html.indexOf('-0.5'), -1, 'ห้ามโชว์แฮนดิแคปฝั่งตรงข้าม');
});

test('renderMyBet มีลายน้ำและกรอบธีมดอส', () => {
  const html = wm.renderMyBet(wm.MOCK, Date.now());
  ok(html.indexOf('dos-wrap') >= 0, 'ต้องมีกรอบธีมดอส');
  ok(html.indexOf('dos-mark') >= 0, 'ต้องมีลายน้ำ');
  ok(html.indexOf('Pickup') >= 0, 'ลายน้ำต้องเขียนว่า Pickup');
});

test('renderMyBet ไม่มีบิล = บอกตรงๆ', () => {
  const html = wm.renderMyBet({ picks: [], bets: [], ledger: {} }, Date.now());
  ok(html.indexOf('ยังไม่มีบิล') >= 0);
});

const wl = loadWeb(['web/js/fmt.js', 'web/js/mock.js', 'web/js/page-forebet.js',
                    'web/js/page-mybet.js', 'web/js/page-ledger.js']);

test('segColor แดงเมื่อติดลบ เขียวเมื่อบวกหรือศูนย์', () => {
  eq(wl.segColor(-1), 'var(--red)');
  eq(wl.segColor(0), 'var(--green)');
  eq(wl.segColor(5), 'var(--green)');
});

test('curveSvg เส้นแบน (ทุกจุดเท่ากัน) ต้องไม่หารด้วยศูนย์', () => {
  const svg = wl.curveSvg([{ 'วันที่':'2026-08-01','สะสม':100 },
                           { 'วันที่':'2026-08-02','สะสม':100 }], 300, 90);
  ok(svg.indexOf('<svg') === 0);
  ok(svg.indexOf('NaN') === -1, 'ห้ามมี NaN หลุดเข้า svg');
  ok(svg.indexOf('Infinity') === -1);
});

test('curveSvg จุดเดียวก็ยังวาดได้ ไม่พัง', () => {
  const svg = wl.curveSvg([{ 'วันที่':'2026-08-01','สะสม':-50 }], 300, 90);
  ok(svg.indexOf('<svg') === 0);
  ok(svg.indexOf('NaN') === -1);
});

test('curveSvg ไม่มีจุดเลย = ไม่วาด', () => {
  eq(wl.curveSvg([], 300, 90), '');
});

test('curveSvg แต่ละท่อนใช้สีตามค่าปลายท่อน + มีเส้นศูนย์', () => {
  const svg = wl.curveSvg([{ 'วันที่':'2026-08-24','สะสม':100 },
                           { 'วันที่':'2026-08-25','สะสม':-150 },
                           { 'วันที่':'2026-08-26','สะสม':615.05 }], 300, 90);
  ok(svg.indexOf('var(--red)') >= 0, 'ท่อนที่จบต่ำกว่าศูนย์ต้องแดง');
  ok(svg.indexOf('var(--green)') >= 0, 'ท่อนที่จบเหนือศูนย์ต้องเขียว');
  ok(svg.indexOf('stroke-dasharray') >= 0, 'ต้องมีเส้นศูนย์แบบประ');
  eq((svg.match(/<line /g) || []).length, 3, 'จุด 3 = ท่อน 2 + เส้นศูนย์ 1');
});

test('renderLedger โชว์ตัวเลขสรุปครบ', () => {
  const html = wl.renderLedger(wl.MOCK);
  ok(html.indexOf('+615.05') >= 0, 'กำไรสะสม');
  ok(html.indexOf('450.00') >= 0, 'ลงไปทั้งหมด');
  ok(html.indexOf('100%') >= 0, 'อัตราชนะ');
  ok(html.indexOf('<svg') >= 0, 'ต้องมีกราฟ');
});

test('renderLedger อัตราชนะเป็น null = ขีด ไม่ใช่ NaN', () => {
  const d = { picks: [], bets: [], ledger: { 'กำไรสะสม':0, 'ลงไปทั้งหมด':0,
    'จำนวนใบ':0, 'อัตราชนะ':null, 'เส้นกราฟ':[] } };
  const html = wl.renderLedger(d);
  ok(html.indexOf('—') >= 0, 'ต้องโชว์ขีด');
  eq(html.indexOf('NaN'), -1);
});

test('renderLedger เรียงบิลใหม่สุดขึ้นก่อน', () => {
  const html = wl.renderLedger(wl.MOCK);
  const iNew = html.indexOf('อองเซ กัลดาส');   // เตะ 26 ส.ค.
  const iOld = html.indexOf('มิลาน');           // เตะ 25 ส.ค. (โชว์แค่ฝั่งที่เลือก)
  ok(iNew < iOld, 'บิลที่เตะทีหลังต้องอยู่บนกว่า');
});

test('หน้า 3 เอาวันที่กับเวลาขึ้นก่อนชื่อทีม', () => {
  const html = wl.renderLedger(wl.MOCK);
  const iWhen = html.indexOf('26 ส.ค. 69');
  const iTeam = html.indexOf('อองเซ กัลดาส');
  ok(iWhen >= 0 && iWhen < iTeam, 'วันที่ต้องมาก่อนชื่อทีม');
  ok(html.indexOf('08:00') >= 0, 'ต้องมีเวลาเตะด้วย');
});

test('หน้า 3 โชว์เฉพาะฝั่งที่เลือก ไม่เอาชื่อทีมทั้งคู่', () => {
  const html = wl.renderLedger(wl.MOCK);
  ok(html.indexOf('อองเซ กัลดาส +0.5') >= 0, 'ต้องมีฝั่งที่เลือก + แฮนดิแคป');
  eq(html.indexOf('จูเนียร์'), -1, 'ห้ามมีชื่อทีมอีกฝั่ง');
  eq(html.indexOf('อินเตอร์'), -1, 'ห้ามมีชื่อทีมอีกฝั่งของอีกบิล');
});

test('หน้า 3 มีบรรทัดย่อยของบิลย่อยในคู่เดิม', () => {
  const html = wl.renderLedger(wl.MOCK);
  ok(html.indexOf('lg-sub') >= 0, 'ต้องมีบรรทัดย่อย');
  ok(html.indexOf('สูง 1.5') >= 0, 'บิลย่อยใบที่ 1');
  ok(html.indexOf('+258.05') >= 0, 'กำไรบิลย่อยใบที่ 2');
});

test('หน้า 3 มีลำดับบิล + หัวเดือนบอกจำนวนบิล', () => {
  const html = wl.renderLedger(wl.MOCK);
  ok(html.indexOf('ส.ค. 69 · 2 บิล') >= 0, 'หัวเดือนต้องบอกว่าเดือนนี้กี่บิล');
  ok(html.indexOf('#2') >= 0, 'ใบใหม่สุดของเดือนได้เลขสูงสุด');
  ok(html.indexOf('#1') >= 0, 'ใบแรกของเดือนคือ #1');
  ok(html.indexOf('#2') < html.indexOf('#1'), 'เลขไล่จากมากลงน้อยตามลำดับที่โชว์');
});

test('ตลาดที่ไม่มีฝั่งเลือก ตกมาใช้ชื่อคู่ VS', () => {
  const html = wl.renderLedger({
    ledger: {},
    bets: [{
      'ตลาด': 'OVER_UNDER', 'เส้น': 2.5,
      'เหย้า': 'Inter', 'เหย้าไทย': 'อินเตอร์',
      'เยือน': 'Milan', 'เยือนไทย': 'มิลาน',
      'เวลาเตะ': '2026-08-25T21:45:00+07:00', 'รวมกำไร': -100, subs: []
    }]
  });
  ok(html.indexOf('อินเตอร์ VS มิลาน · สูง 2.5') >= 0, 'ไม่มีฝั่งเลือกให้บอกคู่ไว้');
});

test('บิลข้ามเดือน แยกหัวเดือน นับใหม่ทุกเดือน', () => {
  const mk = (iso) => ({
    'ตลาด': 'DRAW', 'ทีมที่เลือก': 'Inter', 'ทีมที่เลือกไทย': 'อินเตอร์',
    'เวลาเตะ': iso, 'รวมกำไร': 10, subs: []
  });
  const html = wl.renderLedger({
    ledger: {},
    bets: [mk('2026-09-02T20:00:00+07:00'),
           mk('2026-08-30T20:00:00+07:00'),
           mk('2026-08-29T20:00:00+07:00')]
  });
  ok(html.indexOf('ก.ย. 69 · 1 บิล') >= 0, 'เดือนใหม่แยกหัว');
  ok(html.indexOf('ส.ค. 69 · 2 บิล') >= 0, 'เดือนเก่านับของตัวเอง');
  ok(html.indexOf('ก.ย. 69') < html.indexOf('ส.ค. 69'), 'เดือนใหม่อยู่บน');
});

const a = loadWeb(['web/js/fmt.js', 'web/js/mock.js', 'web/js/api.js']);

test('ไม่มีอะไรเลย = ใช้ข้อมูลตัวอย่าง หน้าไม่ขาว', () => {
  const r = a.pickData(null, null);
  eq(r.source, 'ตัวอย่าง');
  ok(r.data.bets.length > 0);
});

test('มีแคช เน็ตล่ม = ใช้แคช', () => {
  const r = a.pickData(null, { ok: true, at: '2026-08-25T10:00:00+07:00', picks: [], bets: [], ledger: {} });
  eq(r.source, 'แคช');
});

test('ได้ของสด = ใช้ของสด ทับแคช', () => {
  const fresh = { ok: true, at: '2026-08-25T18:00:00+07:00', picks: [], bets: [], ledger: {} };
  eq(a.pickData(fresh, { ok: true, bets: [1] }).source, 'สด');
});

test('เซิร์ฟเวอร์ตอบ ok:false ห้ามนับเป็นของสด', () => {
  const bad = { ok: false, error: 'พัง' };
  eq(a.pickData(bad, { ok: true, at: 'x', picks: [], bets: [], ledger: {} }).source, 'แคช');
  eq(a.pickData(bad, null).source, 'ตัวอย่าง');
});

test('แคชเสีย อ่านแล้วห้ามพังทั้งหน้า', () => {
  a.__ls().setItem('pickup.data.v1', '{ไม่ใช่ json');
  eq(a.loadCache(), null);
});

test('เขียนแคชตอนที่เครื่องไม่ให้เขียน ก็ห้ามพัง', () => {
  const b = loadWeb(['web/js/fmt.js', 'web/js/mock.js', 'web/js/api.js'], {
    localStorage: { getItem() { throw new Error('เต็ม'); }, setItem() { throw new Error('เต็ม'); } }
  });
  b.saveCache({ ok: true });
  eq(b.loadCache(), null);
});

test('แคชเขียนแล้วอ่านกลับได้เหมือนเดิม', () => {
  a.saveCache({ ok: true, at: 'now', picks: [], bets: [], ledger: {} });
  eq(a.loadCache().at, 'now');
});

test('staleNote บอกที่มาของข้อมูลเป็นภาษาคน', () => {
  ok(a.staleNote('สด', Date.now()).indexOf('ล่าสุด') >= 0);
  ok(a.staleNote('แคช', Date.now()).indexOf('ออฟไลน์') >= 0);
  ok(a.staleNote('ตัวอย่าง', Date.now()).indexOf('ตัวอย่าง') >= 0);
});

/* ---- กุญแจฝั่งหน้าเว็บ: รับจาก ?k= ครั้งเดียวแล้วจำไว้ ห้ามฝังในไฟล์ ---- */

const kenv = (search, stubs) => loadWeb(['web/js/fmt.js', 'web/js/mock.js', 'web/js/api.js'],
  Object.assign({ location: { hash: '', search: search || '', pathname: '/' },
                  history: { replaceState: function () {} } }, stubs || {}));

test('อ่านกุญแจจาก ?k= ได้', () => {
  eq(kenv('?k=ss1234').keyFromUrl_(), 'ss1234');
});

test('มีตัวแปรอื่นปนก็ยังอ่านออก และไม่มี k = ได้ค่าว่าง', () => {
  eq(kenv('?x=1&k=ss1234&y=2').keyFromUrl_(), 'ss1234');
  eq(kenv('?x=1').keyFromUrl_(), '');
  eq(kenv('').keyFromUrl_(), '');
});

test('ไฟล์ที่ขึ้น repo ต้องไม่มีกุญแจฝังอยู่', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'web', 'js', 'api.js'), 'utf8');
  ok(!/APP_KEY\s*=\s*['\"][^'\"]+/.test(src), 'ห้ามมีกุญแจตัวจริงในไฟล์');
});

test('เปิดด้วย ?k= แล้วจำไว้ ครั้งต่อไปเปิดเปล่าๆ ก็ยังได้กุญแจเดิม', () => {
  const a = kenv('?k=ss1234');
  eq(a.bootKey_(), 'ss1234');
  eq(a.__ls().getItem('pickup.key.v1'), 'ss1234');
});

test('ไม่มีกุญแจเลย = ไม่ต้องยิงเน็ตให้เปลืองรอ', () => {
  let called = 0;
  const a = kenv('', { fetch: () => { called++; return Promise.resolve({ json: () => ({}) }); } });
  return a.fetchAll_().then((r) => { eq(r, null); eq(called, 0, 'ไม่ควรยิง'); });
});

test('มีกุญแจ = แนบไปกับคำขอ', () => {
  let url = '';
  const a = kenv('?k=ss1234', { fetch: (u) => { url = u; return Promise.resolve({ json: () => ({ ok: true }) }); } });
  a.bootKey_();
  return a.fetchAll_().then(() => {
    ok(url.indexOf('p=all') > 0, 'ต้องขอ p=all');
    ok(url.indexOf('k=ss1234') > 0, 'ต้องแนบกุญแจ');
  });
});

test('เซิร์ฟเวอร์บอกว่ากุญแจไม่ผ่าน = หน้าเว็บต้องบอกให้ใส่กุญแจ ไม่ใช่เงียบ', () => {
  const a = kenv('');
  const r = a.pickData({ ok: false, needKey: true }, null);
  eq(r.source, 'ต้องใส่กุญแจ');
  ok(a.staleNote('ต้องใส่กุญแจ', Date.now()).indexOf('กุญแจ') >= 0);
});

test('กุญแจไม่ผ่าน แต่เคยมีแคช = ยังเห็นของเดิม พร้อมป้ายบอกว่าต้องใส่กุญแจ', () => {
  const a = kenv('');
  const cached = { ok: true, picks: [], bets: [], ledger: {} };
  const r = a.pickData({ ok: false, needKey: true }, cached);
  eq(r.source, 'ต้องใส่กุญแจ');
  eq(r.data, cached);
});

/* ── ของจริงวันแรก: เซิร์ฟเวอร์ตอบมาว่าง (ยังไม่มีบิลสักใบ) ──
   ก่อนหน้านี้เทสต์ใช้ MOCK ที่มีบิลเต็มตลอด ของว่างจริงไม่เคยผ่านตาโค้ดเลย
   ก้อนนี้คือคำตอบจริงจาก /exec เมื่อ 25 ส.ค. 69 ห้ามแก้ให้สวยขึ้น */
const EMPTY_LIVE = {
  ok: true, at: '2026-08-25T17:01:34+07:00',
  picks: [], bets: [],
  ledger: { 'กำไรสะสม': 0, 'ลงไปทั้งหมด': 0, 'จำนวนใบ': 0, 'อัตราชนะ': null, 'เส้นกราฟ': [] }
};
const allPages = loadWeb(['web/js/fmt.js', 'web/js/mock.js', 'web/js/page-forebet.js',
  'web/js/page-mybet.js', 'web/js/page-ledger.js', 'web/js/api.js', 'web/js/app.js']);

test('ข้อมูลว่างของจริง: ทั้ง 3 หน้าต้องปั้นได้ ไม่พังกลางทาง', () => {
  ['forebet', 'mybet', 'ledger'].forEach((r) => {
    const html = allPages.renderPage(r, EMPTY_LIVE, Date.parse('2026-08-25T17:05:00+07:00'));
    ok(typeof html === 'string' && html.length > 0, 'หน้า ' + r + ' ปั้นไม่ออก');
    ok(html.indexOf('undefined') < 0, 'หน้า ' + r + ' มีคำว่า undefined โผล่บนจอ');
    ok(html.indexOf('NaN') < 0, 'หน้า ' + r + ' มีคำว่า NaN โผล่บนจอ');
  });
});

test('ข้อมูลว่างของจริง: แต่ละหน้าต้องบอกว่ายังไม่มีอะไร ไม่ใช่จอโล่ง', () => {
  const t = Date.parse('2026-08-25T17:05:00+07:00');
  ok(allPages.renderPage('forebet', EMPTY_LIVE, t).indexOf('ยังไม่มีคู่ของรอบนี้') >= 0);
  ok(allPages.renderPage('mybet', EMPTY_LIVE, t).indexOf('ยังไม่มีบิล') >= 0);
  ok(allPages.renderPage('ledger', EMPTY_LIVE, t).indexOf('ยังไม่มีบิล') >= 0);
});

test('อัตราชนะเป็น null (ยังไม่มีใบให้คิด) ต้องขึ้นขีด ไม่ใช่ 0% หรือ NaN%', () => {
  const html = allPages.renderPage('ledger', EMPTY_LIVE, Date.now());
  ok(html.indexOf('—') >= 0, 'ควรมีขีด');
  ok(html.indexOf('0%') < 0, 'ห้ามโกหกว่าชนะ 0% ทั้งที่ยังไม่ได้แทง');
});

test('กราฟยังไม่มีจุดสักจุด = ไม่ต้องวาด ไม่ใช่ svg เปล่าที่พัง', () => {
  eq(allPages.curveSvg([], 320, 90), '');
});

test('ข้อมูลว่างของจริงยังนับเป็นของสด ไม่ใช่ตกไปใช้ตัวอย่าง', () => {
  const r = allPages.pickData(EMPTY_LIVE, null);
  eq(r.source, 'สด');
  eq(r.data.bets.length, 0);
});

/* ---- หน้า 2: 1 คู่ = 1 กรอบ + เรียงบรรทัดใหม่ ---- */

test('หน้า 2 แต่ละคู่แยกกรอบของตัวเอง ตัดรูปทีละคู่ได้', () => {
  const html = wm.renderMyBet(wm.MOCK, Date.now());
  const boxes = html.split('dos-wrap').length - 1;
  eq(boxes, wm.MOCK.bets.length, 'จำนวนกรอบต้องเท่าจำนวนคู่');
  const iOnce = html.indexOf('อองเซ กัลดาส');
  const iInter = html.indexOf('อินเตอร์');
  ok(html.lastIndexOf('dos-wrap', iInter) > iOnce, 'คู่อินเตอร์ต้องอยู่คนละกรอบกับคู่แรก');
});

test('หน้า 2 เรียง วันเวลา → ลีก → คู่แข่งขัน และตัวหนังสือคนละแบบ', () => {
  const html = wm.betSlip(wm.MOCK.bets[0], Date.now());
  const iWhen = html.indexOf('slip-when');
  const iLeague = html.indexOf('slip-league');
  const iTeams = html.indexOf('slip-teams');
  ok(iWhen >= 0 && iLeague > iWhen && iTeams > iLeague, 'ต้องเรียง เวลา→ลีก→คู่');
  eq(html.indexOf('slip-top'), -1, 'บรรทัดรวมแบบเก่าต้องไม่เหลือ');
});

/* ---- ป้าย LIVE: กระพริบเฉพาะตอนของสดจริงเท่านั้น ---- */

test('statusPill ขึ้น LIVE เฉพาะข้อมูลสด', () => {
  ok(a.statusPill('สด', Date.now()).indexOf('>LIVE<') >= 0);
  ok(a.statusPill('สด', Date.now()).indexOf('pill live') >= 0);
});

test('statusPill ของเก่า/ตัวอย่าง ห้ามขึ้น LIVE เด็ดขาด', () => {
  ['แคช', 'ตัวอย่าง', 'ต้องใส่กุญแจ'].forEach(function (s) {
    const h = a.statusPill(s, Date.now());
    eq(h.indexOf('LIVE'), -1, s + ' ต้องไม่โชว์ LIVE');
    ok(h.indexOf('pill off') >= 0);
  });
  ok(a.statusPill('แคช', Date.now()).indexOf('OFFLINE') >= 0);
  ok(a.statusPill('ตัวอย่าง', Date.now()).indexOf('DEMO') >= 0);
  ok(a.statusPill('ต้องใส่กุญแจ', Date.now()).indexOf('NO KEY') >= 0);
});

/* ---- หน้า 3 แบบแอปหุ้น ---- */

test('billCount_ นับทุกใบ รวมบิลย่อยและใบที่ยังไม่รู้ผล', () => {
  eq(wl.billCount_(wl.MOCK.bets), 4);   // ใบหลัก 2 + ใบย่อย 2
  eq(wl.billCount_([]), 0);
  eq(wl.billCount_(null), 0);
});

test('roiText_ ยังไม่ลงเงิน = ขีด ไม่ใช่ NaN หรือหารศูนย์', () => {
  eq(wl.roiText_(0, 0), '—');
  eq(wl.roiText_(100, ''), '—');
  ok(wl.roiText_(615.05, 450).indexOf('▲') === 0);
  ok(wl.roiText_(-90, 450).indexOf('▼') === 0);
  eq(wl.roiText_(-90, 450).indexOf('NaN'), -1);
});

test('หน้า 3 หัวแบบแอปหุ้น ป้ายอังกฤษครบ', () => {
  const html = wl.renderLedger(wl.MOCK);
  ['TOTAL P/L', 'ROI', 'BILLS', 'COST', 'WIN RATE'].forEach(function (t) {
    ok(html.indexOf(t) >= 0, 'ต้องมีป้าย ' + t);
  });
  ok(html.indexOf('3 settled') >= 0, 'ต้องบอกด้วยว่ารู้ผลแล้วกี่ใบ');
  ok(html.indexOf('>4<') >= 0, 'BILLS ต้องนับรวมบิลย่อย = 4');
});

/* ================= 3 ตลาดจากหน้าของคู่ (Over / BTTS YES / HT) =================
   เจ้าของสั่ง: "เอาแต่เรท Over · BTTS เอาแต่เรท YES · HT เอาทุกค่า"
   เรทต้องขึ้นหน้าเว็บ "ตามที่ forebet โชว์" (+155 / -208) ห้ามคิดเลขต่อ (กฎข้อ 6) */

test('marketLine_ มีครบ = โชว์ครบทั้ง 3 ตลาด และเรทเป็นตัวหนังสือตามที่เขาโชว์', () => {
  const h = f.marketLine_({ 'เรทOver': '-208', 'เรทBTTSYes': '-152',
    'HTเดาผล': '2', 'HTเปอร์เซ็นต์': '12/17/71', 'HTเรท': '-105' });
  ok(h.indexOf('Over -208') >= 0, 'ต้องมีเรท Over ดิบๆ');
  ok(h.indexOf('BTTS Yes -152') >= 0, 'ต้องมีเรท BTTS ฝั่ง Yes');
  ok(h.indexOf('HT 2 (12/17/71) -105') >= 0, 'HT ต้องครบทุกค่า');
  ok(h.indexOf('2.08') < 0 && h.indexOf('1.48') < 0, 'ห้ามแปลงเรทเป็นทศนิยมเอง');
});

test('marketLine_ ไม่มีสักช่อง = ไม่มีบรรทัดนี้เลย (การ์ดเก่าต้องหน้าตาเหมือนเดิม)', () => {
  eq(f.marketLine_({}), '');
  eq(f.marketLine_({ 'เรทOver': '', 'เรทBTTSYes': '', 'HTเดาผล': '', 'HTเปอร์เซ็นต์': '', 'HTเรท': '' }), '');
  eq(f.marketLine_({ 'เรทOver': '   ' }), '', 'ช่องว่างล้วนก็ถือว่าไม่มี');
});

test('marketLine_ มีบางช่อง = โชว์เฉพาะที่มี ไม่โชว์คำเปล่าๆ', () => {
  const h = f.marketLine_({ 'เรทOver': '+155', 'เรทBTTSYes': '',
    'HTเดาผล': 'X', 'HTเปอร์เซ็นต์': '30/38/32', 'HTเรท': '' });
  ok(h.indexOf('Over +155') >= 0);
  ok(h.indexOf('BTTS') < 0, 'ไม่มีเรท BTTS ก็ห้ามโชว์คำว่า BTTS');
  ok(h.indexOf('HT X (30/38/32)') >= 0, 'HT ไม่มีเรทก็ยังโชว์ผล+เปอร์เซ็นต์ได้');
});

test('renderForebet เอาเรท 3 ตลาดขึ้นการ์ดปักหมุดจริง', () => {
  const html = f.renderForebet(f.MOCK, Date.now());
  ok(html.indexOf('Over -208') >= 0, 'ใบ FEATURED ต้องเห็นเรท Over');
  ok(html.indexOf('BTTS Yes -152') >= 0, 'ใบ FEATURED ต้องเห็นเรท BTTS Yes');
  ok(html.indexOf('HT 2 (12/17/71) -105') >= 0, 'ใบ FEATURED ต้องเห็น HT ครบ');
  ok(html.indexOf('Over +155') >= 0, 'ใบ POTD ต้องเห็นเรท Over ของมันเอง');
});
