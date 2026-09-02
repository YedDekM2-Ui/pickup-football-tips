/* migrate.test.js — ย้ายเครื่องขูดบอลจากบอทเก่า (PIKTAX) มาบอทนี้ 2 ก.ย. 69
   เครื่องขูดบน GitHub Actions พูด "ภาษาเก่า" อยู่ แก้ python ไม่ได้ทั้งกอง
   จึงทำตัวแปลภาษาไว้ที่หัว doGet แทน ข้อที่ต้องพิสูจน์:
     1. ?admin=<กุญแจ> ใช้แทน ?k= ได้ — กุญแจตัวเดียวกัน (APP_KEY)
     2. ?action=<ชื่อ> ใช้แทน ?p=<ชื่อ> ได้
     3. ?ff=<url> ผ่าน "ก่อน" ด่านกุญแจ เพราะฝั่ง python ไม่เคยส่งกุญแจมา
        → ที่กันแทนคือรายชื่อโดเมน ต้อง forebet.com เท่านั้น ไม่งั้นเปิดให้คนทั้งโลกใช้
     4. ล้มแล้วต้องคืนป้าย BAD_URL / FETCH_ERR (สั้นกว่า 500 ตัว) — เป็นสัญญาเดิมกับ python
     5. notify ต้องมีคำว่า "notify OK" ในคำตอบ (fb_watch/fb_pick เช็กคำนี้ตรง ๆ) */

const { loadGas, fakeResponse } = require('./gasEnv');
const { FakeSpreadsheetApp } = require('./fakeSheet');

const FILES = ['gas/Config.gs', 'gas/Compat.gs', 'gas/Sheets.gs', 'gas/Api.gs',
  'gas/Forebet.gs', 'gas/Live.gs', 'gas/Settle.gs', 'gas/Tg.gs',
  'gas/FabScan.gs', 'gas/TalkFootball.gs', 'gas/FabValue.gs', 'gas/Fabel5.gs',
  'gas/FootballTips.gs'];

function env(opt) {
  opt = opt || {};
  const props = Object.assign({ SHEET_ID: 'S', TG_TOKEN: 'T', TG_CHAT: '111', APP_KEY: 'kk' },
                              opt.props || {});
  if (opt.noKey) delete props.APP_KEY;
  const sent = [];
  const hits = [];
  let mid = 700;
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
      hits.push(u);
      if (u.indexOf('api.telegram.org') >= 0) {
        sent.push(JSON.parse((o && o.payload) || '{}'));
        mid++;
        return fakeResponse(200, JSON.stringify({ ok: true, result: { message_id: mid } }));
      }
      const f = opt.net ? opt.net(u) : null;
      return f || fakeResponse(403, 'Just a moment...');
    } }
  });
  g.__sent = sent; g.__hits = hits; g.__props = props;
  return g;
}

/* อ่านข้อความที่ doGet คายออกมา (ตัวปลอมของ ContentService คืน getContent) */
function body(out) { return out && out.getContent ? out.getContent() : String(out); }

/* ---------- 1. กุญแจ: ?admin= = ?k= ---------- */
test('keyOk_ รับได้ทั้ง k= (ภาษาบอทนี้) และ admin= (ภาษาเครื่องขูดเก่า)', () => {
  const g = env();
  ok(g.keyOk_({ k: 'kk' }), 'k= ต้องผ่าน');
  ok(g.keyOk_({ admin: 'kk' }), 'admin= ต้องผ่านด้วยกุญแจตัวเดียวกัน');
  ok(!g.keyOk_({ admin: 'ผิด' }), 'กุญแจผิดต้องไม่ผ่าน');
  ok(!g.keyOk_({}), 'ไม่มีกุญแจต้องไม่ผ่าน');
});

test('ยังไม่ได้ตั้ง APP_KEY = ปิดทุกทาง (fail-closed) แม้ส่ง admin= ว่างมา', () => {
  const g = env({ noKey: true });
  ok(!g.keyOk_({ k: '' }), 'กุญแจว่างห้ามผ่าน');
  ok(!g.keyOk_({ admin: '' }), 'admin ว่างห้ามผ่าน');
  const out = JSON.parse(body(g.doGet({ parameter: { action: 'f5stat', admin: '' } })));
  eq(out.needKey, true);
});

/* ---------- 2. ?action= แปลเป็นทางเดียวกับ ?p= ---------- */
test('?action=<ชื่อ> วิ่งเข้าทางเดียวกับ ?p=<ชื่อ>', () => {
  const a = env(), b = env();
  const viaOld = body(a.doGet({ parameter: { admin: 'kk', action: 'f5stat' } }));
  const viaNew = body(b.doGet({ parameter: { k: 'kk', p: 'f5stat' } }));
  eq(viaOld, viaNew);
  ok(viaOld.indexOf('needKey') < 0, 'ส่งกุญแจถูกแล้วต้องไม่ติดด่าน');
});

test('?p= ชนะ ?action= ถ้าส่งมาทั้งคู่ (ภาษาบอทนี้เป็นหลัก)', () => {
  const g = env();
  body(g.doGet({ parameter: { k: 'kk', p: 'f5stat', action: 'f5poke' } }));
  eq(g.__hits.filter((u) => u.indexOf('api.github.com') >= 0).length, 0,
     'ต้องได้ผลของ f5stat — ห้ามเผลอไปสะกิด workflow ของ f5poke');
});

/* ---------- 3. รายชื่อโดเมน = ด่านแทนกุญแจของ ?ff= ---------- */
test('ffAllowed_ ปล่อยเฉพาะ forebet.com (และโดเมนย่อย) ผ่าน https', () => {
  const g = env();
  ok(g.ffAllowed_('https://www.forebet.com/en/football-tips-and-predictions-for-today'));
  ok(g.ffAllowed_('https://forebet.com/scripts/getrs.php?ln=en'));
  ok(g.ffAllowed_('https://m.forebet.com/x'), 'โดเมนย่อยของ forebet ผ่านได้');
  ok(!g.ffAllowed_('https://evil.com/'), 'โดเมนอื่นห้ามผ่าน');
  ok(!g.ffAllowed_('https://notforebet.com/'), 'ชื่อลงท้ายคล้ายกันแต่คนละโดเมน ห้ามผ่าน');
  ok(!g.ffAllowed_('https://forebet.com.evil.com/'), 'เอาชื่อเราไปแปะหน้าโดเมนตัวเอง ห้ามผ่าน');
  ok(!g.ffAllowed_('http://www.forebet.com/'), 'http ธรรมดาห้ามผ่าน');
  ok(!g.ffAllowed_(''), 'ว่างห้ามผ่าน');
});

test('ffFetch_ โดเมนไม่ใช่ forebet = คืน BAD_URL และห้ามยิงเน็ตเลยสักครั้ง', () => {
  const g = env();
  eq(g.ffFetch_('https://evil.com/steal'), 'BAD_URL');
  eq(g.__hits.length, 0);
});

test('ffFetch_ ยิงตรงติด = คายข้อความดิบทันที ไม่ต้องอ้อม', () => {
  const g = env({ net: (u) => (u.indexOf('r.jina.ai') < 0
    ? fakeResponse(200, '[[1,"A","B"]]') : fakeResponse(200, 'ไม่ควรมาถึงตรงนี้')) });
  eq(g.ffFetch_('https://www.forebet.com/scripts/getrs.php?ln=en'), '[[1,"A","B"]]');
  eq(g.__hits.filter((u) => u.indexOf('r.jina.ai') >= 0).length, 0, 'ยิงตรงติดแล้วห้ามอ้อมซ้ำ');
});

test('ffFetch_ ยิงตรงโดน 403 = อ้อมต่อเอง แล้วได้หน้า markdown มา', () => {
  const g = env({ net: (u) => (u.indexOf('r.jina.ai') >= 0
    ? fakeResponse(200, '# Forebet tips\nA vs B') : fakeResponse(403, 'Just a moment...')) });
  const t = g.ffFetch_('https://www.forebet.com/en/live-football-tips');
  ok(t.indexOf('Forebet tips') >= 0, 'ต้องได้เนื้อหน้ามา');
  ok(g.__hits.some((u) => u.indexOf('r.jina.ai') >= 0), 'ต้องมีการอ้อม');
});

test('ffFetch_ พังทุกทาง = คืน FETCH_ERR สั้น ๆ (python นับ <500 ตัวว่าล้ม แล้วยิงซ้ำเอง)', () => {
  const g = env();                       /* net ปริยาย = 403 ทุกทาง */
  const t = g.ffFetch_('https://www.forebet.com/en/live-football-tips');
  eq(t, 'FETCH_ERR');
  ok(t.length < 500, 'ป้ายล้มต้องสั้นกว่า 500 ตัวอักษร');
});

test('เจ้าของสั่งปิดทางอ้อม (FB_PROXY=-) แล้ว ?ff= ต้องไม่แอบอ้อม', () => {
  const g = env({ props: { FB_PROXY: '-' },
    net: (u) => (u.indexOf('r.jina.ai') >= 0 ? fakeResponse(200, 'ห้ามได้อันนี้')
                                             : fakeResponse(403, 'Just a moment...')) });
  eq(g.ffFetch_('https://www.forebet.com/en/live-football-tips'), 'FETCH_ERR');
  eq(g.__hits.filter((u) => u.indexOf('r.jina.ai') >= 0).length, 0);
});

/* ---------- 4. ?ff= ต้องผ่านได้โดยไม่มีกุญแจ + คายดิบ ---------- */
test('?ff= ไม่ต้องมีกุญแจ (python ไม่เคยส่งมา) และคายข้อความดิบ ไม่ห่อ JSON', () => {
  const g = env({ net: () => fakeResponse(200, '[[9,"X"]]') });
  const out = body(g.doGet({ parameter: { ff: 'https://www.forebet.com/scripts/getrs.php?ln=en' } }));
  eq(out, '[[9,"X"]]');
});

test('?ff= โดเมนอื่น = ได้ BAD_URL ไม่ใช่หน้าเว็บของเขา', () => {
  const g = env({ net: () => fakeResponse(200, 'ความลับของคนอื่น') });
  eq(body(g.doGet({ parameter: { ff: 'https://evil.com/x' } })), 'BAD_URL');
});

test('ทางอื่นที่ไม่ใช่ ff ยังต้องติดด่านกุญแจเหมือนเดิม', () => {
  const g = env();
  const out = JSON.parse(body(g.doGet({ parameter: { action: 'f5dump' } })));
  eq(out.needKey, true);
});

/* ---------- 5. notify ---------- */
test('notify_ ส่งข้อความเข้าเทเลแกรม แล้วตอบคำว่า "notify OK" (python เช็กคำนี้)', () => {
  const g = env();
  const out = g.notify_('⚽ ทดสอบ');
  eq(out.indexOf('notify OK'), 0, 'ต้องขึ้นต้นด้วย notify OK ได้ ' + out);
  eq(g.__sent.length, 1);
  eq(g.__sent[0].text, '⚽ ทดสอบ');
});

test('notify_ ไม่มีข้อความ / ยังไม่มีเจ้าของ = บอกเหตุ ไม่ใช่ตอบ OK ลอย ๆ', () => {
  const g = env();
  ok(g.notify_('').indexOf('notify OK') < 0);
  const g2 = env({ props: { TG_CHAT: '' } });
  const out = g2.notify_('ข้อความ');
  ok(out.indexOf('notify OK') < 0, 'ยังไม่รู้ว่าจะส่งหาใคร ห้ามตอบ OK');
  eq(g2.__sent.length, 0);
});

test('?action=notify&text=.. วิ่งได้จริงผ่านหัว doGet และคายดิบ', () => {
  const g = env();
  const out = body(g.doGet({ parameter: { admin: 'kk', action: 'notify', text: '⚽ ใบเตือน' } }));
  eq(out.indexOf('notify OK'), 0, 'ได้ ' + out);
  eq(g.__sent[0].text, '⚽ ใบเตือน');
});

test('notify ต้องอยู่หลังด่านกุญแจ — คนอื่นสั่งบอทเราส่งข้อความไม่ได้', () => {
  const g = env();
  const out = JSON.parse(body(g.doGet({ parameter: { action: 'notify', text: 'สแปม' } })));
  eq(out.needKey, true);
  eq(g.__sent.length, 0);
});

/* ---------- 6. ทางเดิมของเครื่องขูดครบทุกตัว ---------- */
test('ชื่อทางที่เครื่องขูดเรียกอยู่ ต้องมีครบในบอทนี้', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'gas', 'Api.gs'), 'utf8');
  ['f5alert', 'f5stamp', 'f5grade', 'f5dump', 'notify',
   'fvalert', 'fvpending', 'fvgrade'].forEach((name) => {
    ok(src.indexOf("p === '" + name + "'") >= 0, 'ขาดทาง ' + name);
  });
});

/* ---------- 7. ตั้งค่าลับจากลิงก์ ---------- */
test('setprop ตั้งค่าได้ แต่ห้ามคายค่าจริงกลับออกไป', () => {
  const g = env();
  const out = JSON.parse(body(g.doGet({ parameter: { k: 'kk', p: 'setprop', n: 'GH_TOKEN', v: 'ghp_ลับมาก' } })));
  eq(out.ok, true);
  eq(g.__props.GH_TOKEN, 'ghp_ลับมาก');
  ok(JSON.stringify(out).indexOf('ghp_ลับมาก') < 0, 'ค่าจริงห้ามอยู่ในคำตอบ');
});

test('setprop ตั้งได้เฉพาะชื่อที่อนุญาต — ทับ APP_KEY ไม่ได้', () => {
  const g = env();
  const out = JSON.parse(body(g.doGet({ parameter: { k: 'kk', p: 'setprop', n: 'APP_KEY', v: 'ของฉัน' } })));
  eq(out.ok, false);
  eq(g.__props.APP_KEY, 'kk', 'กุญแจประตูต้องไม่ถูกทับ');
});

test('setprop ต้องมีกุญแจ — คนอื่นตั้งค่าลับให้เราไม่ได้', () => {
  const g = env();
  const out = JSON.parse(body(g.doGet({ parameter: { p: 'setprop', n: 'GH_TOKEN', v: 'x' } })));
  eq(out.needKey, true);
  ok(!g.__props.GH_TOKEN);
});

test('setprop ส่งค่าว่าง = ลบทิ้ง · cfgstat บอกแค่ว่าตั้งแล้วยัง', () => {
  const g = env({ props: { GH_TOKEN: 'abcd' } });
  g.setProp_('GH_TOKEN', '');
  ok(!g.__props.GH_TOKEN);
  const st = JSON.parse(body(g.doGet({ parameter: { k: 'kk', p: 'cfgstat' } })));
  eq(st['ค่า'].GH_TOKEN, 'ยังไม่ได้ตั้ง');
  ok(st['ค่า'].APP_KEY.indexOf('ตั้งแล้ว') === 0);
  ok(JSON.stringify(st).indexOf('kk') < 0, 'cfgstat ห้ามหลุดค่ากุญแจ');
});

/* ---------- 6. กุญแจใบที่ 2 (SCRAPER_KEY) ของเครื่องขูดบน GitHub Actions ----------
   ปัญหาจริง: APP_KEY อยู่ใน Script Properties อ่านจากข้างนอกไม่ได้เลย
   จะไปตั้ง secret ฝั่ง GitHub ให้ตรงกันจึงติดตาย
   ทางออก: เปิดประตูให้ "ตั้งกุญแจใบที่ 2 ได้ครั้งเดียวตอนที่ยังว่าง" แล้วปิดถาวร */
test('claimkey ตั้งกุญแจใบที่ 2 ได้ตอนยังว่าง แล้วใช้ admin= ผ่านด่านได้', () => {
  const g = env();
  const K = 'ABCDEFGHIJKLMNOPQRSTUVWX9';
  ok(!g.keyOk_({ admin: K }), 'ก่อนตั้ง ต้องยังไม่ผ่าน');
  const out = JSON.parse(body(g.doGet({ parameter: { p: 'claimkey', v: K } })));
  eq(out.ok, true);
  eq(g.__props.SCRAPER_KEY, K);
  ok(g.keyOk_({ admin: K }), 'ตั้งแล้วต้องผ่าน');
  ok(g.keyOk_({ k: 'kk' }), 'กุญแจเดิมต้องยังใช้ได้');
  ok(JSON.stringify(out).indexOf(K) < 0, 'คำตอบห้ามมีค่ากุญแจ');
});

test('claimkey ตั้งซ้ำไม่ได้ — ตั้งแล้วประตูปิดถาวร', () => {
  const K = 'ABCDEFGHIJKLMNOPQRSTUVWX9';
  const g = env({ props: { SCRAPER_KEY: K } });
  const out = JSON.parse(body(g.doGet({ parameter: { p: 'claimkey', v: 'ZZZZZZZZZZZZZZZZZZZZZZZZZZ' } })));
  eq(out.ok, false);
  eq(g.__props.SCRAPER_KEY, K, 'ของเดิมห้ามถูกทับ');
});

test('claimkey ไม่รับกุญแจสั้น (กันคนเดาสุ่ม)', () => {
  const g = env();
  const out = JSON.parse(body(g.doGet({ parameter: { p: 'claimkey', v: 'สั้นไป' } })));
  eq(out.ok, false);
  ok(!g.__props.SCRAPER_KEY);
});

test('มีแต่ SCRAPER_KEY ไม่มี APP_KEY ก็ยังเข้าได้ · ไม่มีสักใบ = ปิดตาย', () => {
  const K = 'ABCDEFGHIJKLMNOPQRSTUVWX9';
  const g = env({ noKey: true, props: { SCRAPER_KEY: K } });
  ok(g.keyOk_({ admin: K }));
  ok(!g.keyOk_({ admin: 'x' }));
  const g2 = env({ noKey: true });
  ok(!g2.keyOk_({ admin: '' }), 'ไม่มีกุญแจสักใบ ต้องปิดตาย');
});

test('cfgstat บอกว่า SCRAPER_KEY ตั้งแล้วยัง โดยไม่คายค่า', () => {
  const K = 'ABCDEFGHIJKLMNOPQRSTUVWX9';
  const g = env({ props: { SCRAPER_KEY: K } });
  const st = JSON.parse(body(g.doGet({ parameter: { k: 'kk', p: 'cfgstat' } })));
  ok(st['ค่า'].SCRAPER_KEY.indexOf('ตั้งแล้ว') === 0);
  ok(JSON.stringify(st).indexOf(K) < 0, 'ห้ามหลุดค่ากุญแจ');
});
