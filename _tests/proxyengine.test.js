/* proxyengine.test.js — หัว X-Engine ของทางอ้อม (jina)
   ทำไมต้องมี: Cloudflare กั้นทั้ง IP ของกูเกิล (403) และตัวดึงปกติของ jina
   (ตอบ 200 แต่เป็นหน้ากันบอท) วัดจริง 21 ก.ย. 69 มีแต่ engine=browser ที่ได้หน้าจริง
   ถ้าหัวนี้หลุดไป ทางอ้อมจะกลับไปได้ "200 ที่ไม่ใช่หน้า" เหมือนเดิมโดยไม่มีใครรู้ */

const { loadGas, fakeResponse } = require('./gasEnv');

function env(props) {
  const seen = [];
  const g = loadGas(['gas/Config.gs', 'gas/Compat.gs'], {
    UrlFetchApp: { fetch: (url, opt) => { seen.push({ url, opt }); return fakeResponse(200, 'x'); } }
  });
  Object.keys(props || {}).forEach((k) => {
    g.PropertiesService.getScriptProperties().setProperty(k, props[k]);
  });
  g.__seen = seen;
  return g;
}

test('มีคีย์ jina → ทางอ้อมต้องสั่ง engine browser', () => {
  const g = env({ JINA_KEY: 'k1' });
  g.cpGet_('https://www.forebet.com/x', 'https://r.jina.ai/', false);
  eq(g.__seen[0].opt.headers['X-Engine'], 'browser');
  eq(g.__seen[0].opt.headers['Authorization'], 'Bearer k1');
});

test('ไม่มีคีย์ jina → ห้ามสั่ง engine (โควต้า browser ต้องมีบัตร)', () => {
  const g = env({});
  g.cpGet_('https://www.forebet.com/x', 'https://r.jina.ai/', false);
  eq(g.__seen[0].opt.headers['X-Engine'], undefined);
});

test('ยิงตรง (ไม่ผ่านทางอ้อม) ห้ามมีหัวของ jina ติดไปด้วย', () => {
  const g = env({ JINA_KEY: 'k1' });
  g.cpGet_('https://www.forebet.com/x', '', false);
  eq(g.__seen[0].opt.headers['X-Engine'], undefined);
  eq(g.__seen[0].opt.headers['Authorization'], undefined);
});

test('ทาง markdown (FabScan) ก็ต้องได้ engine browser ด้วย', () => {
  const g = env({ JINA_KEY: 'k1' });
  g.cpGet_('https://www.forebet.com/x', 'https://r.jina.ai/', true);
  eq(g.__seen[0].opt.headers['X-Engine'], 'browser');
  eq(g.__seen[0].opt.headers['X-Return-Format'], undefined);
});

test("สวิตช์ปิด FB_ENGINE='-' ต้องกลับไปใช้ตัวดึงปกติ", () => {
  const g = env({ JINA_KEY: 'k1', FB_ENGINE: '-' });
  g.cpGet_('https://www.forebet.com/x', 'https://r.jina.ai/', false);
  eq(g.__seen[0].opt.headers['X-Engine'], undefined);
});

test('ตั้ง FB_ENGINE เป็นชื่ออื่นได้ (เผื่อ jina เปลี่ยนชื่อ engine)', () => {
  const g = env({ JINA_KEY: 'k1', FB_ENGINE: 'cf-browser-rendering' });
  g.cpGet_('https://www.forebet.com/x', 'https://r.jina.ai/', false);
  eq(g.__seen[0].opt.headers['X-Engine'], 'cf-browser-rendering');
});

test('FB_ENGINE ต้องตั้งผ่านลิงก์ได้ (อยู่ในรายชื่อที่อนุญาต)', () => {
  const g = env({});
  ok(g.CFG_ALLOW.indexOf('FB_ENGINE') >= 0, 'FB_ENGINE ต้องอยู่ใน CFG_ALLOW');
});
