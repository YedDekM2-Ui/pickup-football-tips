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

test('betSlip โชว์เงิน ราคา ผล และบิลย่อยครบ', () => {
  const html = wm.betSlip(wm.MOCK.bets[0], Date.now());
  ok(html.indexOf('อองเซ กัลดาส') >= 0, 'ต้องมีทีมที่เลือก');
  ok(html.indexOf('+0.5') >= 0, 'ต้องมีแฮนดิแคป');
  ok(html.indexOf('1.95') >= 0, 'ต้องมีราคา');
  ok(html.indexOf('300.00') >= 0, 'ต้องมีเงินที่ลง');
  ok(html.indexOf('ชนะเต็ม') >= 0, 'ต้องมีผล');
  ok(html.indexOf('สูง 1.5') >= 0, 'ต้องมีบิลย่อยใบที่ 1');
  ok(html.indexOf('เสมอ') >= 0, 'ต้องมีบิลย่อยใบที่ 2');
  ok(html.indexOf('6.161') >= 0, 'ราคาบิลย่อยห้ามปัด');
  ok(html.indexOf('450.00') >= 0, 'ต้องมียอดรวมเงินทั้งคู่');
  ok(html.indexOf('+615.05') >= 0, 'ต้องมียอดรวมกำไรทั้งคู่');
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
  const iOld = html.indexOf('อินเตอร์');        // เตะ 25 ส.ค.
  ok(iNew < iOld, 'บิลที่เตะทีหลังต้องอยู่บนกว่า');
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
