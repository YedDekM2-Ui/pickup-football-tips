/* fabscan.test.js — /หาคู่ (ย้ายมาจาก PIKTAX)
   ข้อที่ต้องพิสูจน์:
     1. เจ้าของปิดทางอ้อม (FB_PROXY='-') = ไม่ยิงเน็ตเลย ไม่ใช่ยิงตรงแล้วโดน 403 รัวๆ
     2. ดึงไม่ได้ กับ ดึงได้แต่แกะไม่ออก ต้องเป็นคนละข้อความ (คนละวิธีแก้)
     3. ห้ามส่งหัว X-Return-Format:html ตอนขอ markdown ไม่งั้นตัวแกะพังเงียบ
     4. /หาคู่ ต้องไม่ยิงข้อความเปล่าตามหลัง (ตัวมันส่งเอง) */

const { loadGas, fakeResponse } = require('./gasEnv');
const { FakeSpreadsheetApp } = require('./fakeSheet');

const FILES = ['gas/Config.gs', 'gas/Compat.gs', 'gas/Sheets.gs', 'gas/Api.gs',
  'gas/Forebet.gs', 'gas/Live.gs', 'gas/Settle.gs', 'gas/Tg.gs', 'gas/FabScan.gs'];

/** env — เก็บทุกครั้งที่ยิงเน็ต (__http) และทุกครั้งที่ส่งเทเลแกรม (__sent) */
function env(props, fetchFn) {
  const p = Object.assign({ SHEET_ID: 'S', TG_TOKEN: 'T', TG_CHAT: '111' }, props || {});
  const http = [], sent = [];
  const g = loadGas(FILES, {
    SpreadsheetApp: new FakeSpreadsheetApp({ BETS: [['ID']], PICKS: [['ID']] }),
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (k in p ? p[k] : null),
      setProperty: (k, v) => { p[k] = String(v); },
      deleteProperty: (k) => { delete p[k]; }
    }) },
    UrlFetchApp: { fetch: (url, opt) => {
      http.push({ url: String(url), opt: opt || {} });
      if (String(url).indexOf('api.telegram.org') >= 0) {
        sent.push(JSON.parse((opt && opt.payload) || '{}'));
        return fakeResponse(200, JSON.stringify({ ok: true, result: {} }));
      }
      return fetchFn ? fetchFn(String(url), opt) : fakeResponse(403, 'blocked');
    } }
  });
  g.__http = http; g.__sent = sent; g.__props = p;
  return g;
}

const LONG = 'x'.repeat(6000);   // ยาวพอผ่านด่าน "สั้นผิดปกติ" แต่แกะไม่ออก

/* ---------- สวิตช์ปิดทางอ้อมของเจ้าของ ---------- */

test('FB_PROXY=- (ปิดทางอ้อม) = ไม่ยิงเน็ตสักครั้ง', () => {
  const g = env({ FB_PROXY: '-' });
  eq(g.fsFetchMd_('https://www.forebet.com/en/values'), '');
  eq(g.__http.length, 0, 'ปิดแล้วยังยิงอยู่ = เสียเวลาเปล่า/โดนแบน');
});

/* ---------- 2 เหตุผลที่ต้องแยกกัน ---------- */

test('ดึงหน้าไม่ได้ = บอกว่าดึงไม่ได้ (ไม่ใช่ "แกะไม่ออก")', () => {
  const g = env({ FB_PROXY: 'https://r.jina.ai/' }, () => fakeResponse(429, 'rate limit'));
  const msgs = g.fsScanText_({});
  eq(msgs.length, 1);
  ok(/ดึงหน้า Live coef\. ไม่ได้/.test(msgs[0]), msgs[0]);
});

test('ดึงได้แต่แกะไม่ออก = บอกว่าหน้าอาจเปลี่ยนโครง + บอกความยาวที่ได้', () => {
  const g = env({ FB_PROXY: 'https://r.jina.ai/' }, () => fakeResponse(200, LONG));
  const msgs = g.fsScanText_({});
  eq(msgs.length, 1);
  ok(/แกะตารางไม่ออก/.test(msgs[0]), msgs[0]);
  ok(msgs[0].indexOf('6000') >= 0, 'ต้องบอกความยาวไว้ไล่ทีหลัง: ' + msgs[0]);
});

test('สั้นผิดปกติ (หน้าเออเร่อของทางอ้อม) ไม่นับว่าสำเร็จ + ลอง 3 รอบ', () => {
  const g = env({ FB_PROXY: 'https://r.jina.ai/' }, () => fakeResponse(200, 'oops'));
  eq(g.fsFetchMd_('https://www.forebet.com/en/values'), '');
  eq(g.__http.length, 3, 'ต้องลองซ้ำ 3 รอบ Jina ตกบ่อย');
});

/* ---------- หัวที่ส่งไป ---------- */

test('ขอ markdown ห้ามใส่หัว X-Return-Format (ตัวแกะอ่าน markdown)', () => {
  const g = env({ FB_PROXY: 'https://r.jina.ai/' }, () => fakeResponse(200, LONG));
  g.fsFetchMd_('https://www.forebet.com/en/values');
  const h = g.__http[0].opt.headers || {};
  eq(h['X-Return-Format'], undefined, 'ใส่หัวนี้แล้วจะได้ html ตัวแกะพังเงียบ');
  ok(g.__http[0].url.indexOf('https://r.jina.ai/https://www.forebet.com/en/values') === 0, g.__http[0].url);
});

test('มี JINA_KEY = แนบ Bearer ไปด้วย', () => {
  const g = env({ FB_PROXY: 'https://r.jina.ai/', JINA_KEY: 'KKK' }, () => fakeResponse(200, LONG));
  g.fsFetchMd_('https://www.forebet.com/en/values');
  eq((g.__http[0].opt.headers || {}).Authorization, 'Bearer KKK');
});

test('ฟีด getrs.php ยิงตรงก่อน ถ้าไม่ใช่ JSON จริงห้ามนับว่าผ่าน', () => {
  const g = env({ FB_PROXY: '-' }, () => fakeResponse(200, '<html>error</html>'));
  eq(g.fbFetchJsonText_('https://www.forebet.com/np/getrs.php?tp=ht'), '',
     'หน้าเออเร่อ 200 ต้องไม่ถูกนับว่าสำเร็จ');
});

/* ---------- ทางเดินคำสั่งในบอท ---------- */

test('/หาคู่ ตอบรับก่อน แล้วส่งการ์ด — ไม่มีข้อความเปล่าตามหลัง', () => {
  const g = env({ FB_PROXY: 'https://r.jina.ai/' }, () => fakeResponse(429, 'x'));
  const out = g.tgHandle_({ message: { chat: { id: 111 }, text: '/หาคู่' } });
  eq(out, '', 'ต้อง return ว่าง ไม่งั้นท้ายฟังก์ชันจะยิงซ้ำอีกใบ');
  eq(g.__sent.length, 2, 'ตอบรับ 1 + ผล 1');
  ok(/กำลังดึง/.test(g.__sent[0].text), g.__sent[0].text);
  ok(/ดึงหน้า Live coef\. ไม่ได้/.test(g.__sent[1].text), g.__sent[1].text);
});

test('/หาคู่ 30 = ตั้งค่าคุ้มขั้นต่ำ 30 (ไม่ใช่คำสั่งไม่รู้จัก)', () => {
  const g = env({ FB_PROXY: '-' });
  const out = g.tgHandle_({ message: { chat: { id: 111 }, text: '/หาคู่ 30' } });
  eq(out, '');
  ok(!/ไม่เข้าใจ/.test(String(g.__sent.map(s => s.text).join(' '))), 'ต้องไม่ตกไปช่องไม่รู้จัก');
});

test('ปุ่มกับ /help มี /หาคู่', () => {
  const g = env({ FB_PROXY: '-' });
  const kb = JSON.stringify(g.tgKeyboard_());
  ok(kb.indexOf('/หาคู่') >= 0, 'ปุ่มหาย เจ้าของต้องพิมพ์เอาทุกครั้ง');
  ok(g.TG_MENU_.indexOf('/หาคู่') >= 0, '/help ไม่บอก = ไม่มีใครรู้ว่ามี');
});

/* ---------- ล็อกของ Compat ---------- */

test('logEvent_ เก็บได้ไม่เกิน 30 บรรทัด (Script Property มีเพดาน 9KB)', () => {
  const g = env({ FB_PROXY: '-' });
  for (let i = 0; i < 40; i++) g.logEvent_('INFO', 'บรรทัด ' + i);
  const lines = g.runLog_().split('\n');
  eq(lines.length, 30);
  ok(/\u0e1a\u0e23\u0e23\u0e17\u0e31\u0e14 39/.test(lines[29]), lines[29]);
});

test('logEvent_ ล้มก็ห้ามล้มงานจริงตาม', () => {
  const g = loadGas(FILES, {
    SpreadsheetApp: new FakeSpreadsheetApp({ BETS: [['ID']] }),
    PropertiesService: { getScriptProperties: () => { throw new Error('พัง'); } }
  });
  g.logEvent_('ERROR', 'ทดสอบ');   // ต้องไม่โยนออกมา
  eq(g.runLog_(), '');
});
