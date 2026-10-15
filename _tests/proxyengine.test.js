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

/* ---- v65: ตัวยิงอีก 2 ตัวที่ v62 ลืม ----
   ของจริง 21 ก.ย. 69 หน้า 1 ดึงบอลไม่ได้ trail="อ้อม:200(ไม่ใช่หน้า)" ทั้งที่ v62 ใส่หัวแล้ว
   เพราะ Forebet.gs/TalkFootball.gs มีตัวยิงของตัวเอง ไม่ได้ผ่าน cpGet_
   เทสต์ชุดนี้กันไม่ให้ตัวยิงตัวใดตัวหนึ่งหลุดจากด่านกลาง cpJinaHead_ อีก */

function envFor(files, props) {
  const seen = [];
  const g = loadGas(files, {
    UrlFetchApp: { fetch: (url, opt) => { seen.push({ url, opt }); return fakeResponse(200, 'x'); } }
  });
  Object.keys(props || {}).forEach((k) => {
    g.PropertiesService.getScriptProperties().setProperty(k, props[k]);
  });
  g.__seen = seen;
  return g;
}

const FB_FILES = ['gas/Config.gs', 'gas/Compat.gs', 'gas/Forebet.gs'];
const TF_FILES = ['gas/Config.gs', 'gas/Compat.gs', 'gas/TalkFootball.gs'];

test('fbFetch_ (คู่ปักหมุดหน้า 1) ต้องสั่ง engine browser ด้วย', () => {
  const g = envFor(FB_FILES, { JINA_KEY: 'k1' });
  g.fbFetch_('https://www.forebet.com/en/football-tips-and-predictions-for-today', 'https://r.jina.ai/');
  eq(g.__seen[0].opt.headers['X-Engine'], 'browser');
  eq(g.__seen[0].opt.headers['Authorization'], 'Bearer k1');
  eq(g.__seen[0].opt.headers['X-Return-Format'], 'html');
});

test('fbFetch_ ยิงตรง ห้ามมีหัวของ jina ติดไป', () => {
  const g = envFor(FB_FILES, { JINA_KEY: 'k1' });
  g.fbFetch_('https://www.forebet.com/x', '');
  eq(g.__seen[0].opt.headers['X-Engine'], undefined);
  eq(g.__seen[0].opt.headers['Authorization'], undefined);
});

test("fbFetch_ ต้องฟัง FB_ENGINE='-' (สวิตช์ปิดต้องปิดได้ทุกตัวยิง)", () => {
  const g = envFor(FB_FILES, { JINA_KEY: 'k1', FB_ENGINE: '-' });
  g.fbFetch_('https://www.forebet.com/x', 'https://r.jina.ai/');
  eq(g.__seen[0].opt.headers['X-Engine'], undefined);
});

test('tfGet_ (/talkfootball) ต้องสั่ง engine browser ด้วย', () => {
  const g = envFor(TF_FILES, { JINA_KEY: 'k1' });
  g.tfGet_('https://www.forebet.com/x', 'https://r.jina.ai/');
  eq(g.__seen[0].opt.headers['X-Engine'], 'browser');
  eq(g.__seen[0].opt.headers['Authorization'], 'Bearer k1');
});

test('tfGet_ ไม่มีคีย์ → ห้ามสั่ง engine', () => {
  const g = envFor(TF_FILES, {});
  g.tfGet_('https://www.forebet.com/x', 'https://r.jina.ai/');
  eq(g.__seen[0].opt.headers['X-Engine'], undefined);
});

/* ── ฟีดขาดกลาง (ตัวเกรดเคยฟ้อง "หาไม่เจอ" ทั้งที่ของมีอยู่) ───────────────── */

function feedEnv(bodies) {
  const seen = [];
  const g = loadGas(['gas/Config.gs', 'gas/Compat.gs'], {
    UrlFetchApp: {
      fetch: (url, opt) => {
        seen.push({ url, opt });
        const b = bodies[Math.min(seen.length - 1, bodies.length - 1)];
        return fakeResponse(200, b);
      }
    }
  });
  g.fbProxy_ = () => 'https://r.jina.ai/';
  g.__seen = seen;
  return g;
}

const FULL = '[[{"a":1}],["x","3645"]]';
const CUT = '[[{"a":1}],["x","insight_link';   /* ใบครึ่ง ที่ของจริงคายมา ~526 ไบต์ */

test('ใบที่จบกลางคำ = ยังไม่ครบ ห้ามนับว่าสำเร็จ', () => {
  const g = feedEnv([FULL]);
  eq(g.fbFeedOk_(FULL), true);
  eq(g.fbFeedOk_(CUT), false);
  eq(g.fbFeedOk_(''), false);
  eq(g.fbFeedOk_('<html>ok</html>'), false);
});

test('ยิงตรงได้ใบครบ → จบเลย ไม่ต้องอ้อม', () => {
  const g = feedEnv([FULL]);
  eq(g.fbFetchJsonText_('u'), FULL);
  eq(g.__seen.length, 1);
});

test('ใบขาด → ยิงซ้ำจนได้ใบครบ (ของจริงพังเป็นใบ ๆ)', () => {
  const g = feedEnv([CUT, CUT, FULL]);
  eq(g.fbFetchJsonText_('u'), FULL);
  eq(g.__seen.length, 3);
});

test('ขาดทุกรอบ → ต้องหยุด ไม่วนไม่จบ', () => {
  const g = feedEnv([CUT]);
  eq(g.fbFetchJsonText_('u'), CUT);
  eq(g.__seen.length, 3);
});

/* ทางอ้อมแบบมีคีย์ (ScrapingAnt/Scrape.do/ScraperAPI) — ตั้งผ่าน FB_PROXY
   ทำไม: 15 ต.ค. 69 jina ฟรีโดน Cloudflare หมด ต้องสลับบริการได้จากลิงก์ */
test('FB_PROXY ลงท้าย = → url ต้องเข้ารหัสก่อนต่อ', () => {
  const g = env({});
  g.cpGet_('https://www.forebet.com/x?a=1&b=2', 'https://api.scrapingant.com/v2/general?x-api-key=K&url=', false);
  eq(g.__seen[0].url, 'https://api.scrapingant.com/v2/general?x-api-key=K&url=' + encodeURIComponent('https://www.forebet.com/x?a=1&b=2'));
});

test('บริการอื่นที่ไม่ใช่ jina → คีย์ jina ห้ามหลุดไป', () => {
  const g = env({ JINA_KEY: 'k1' });
  g.cpGet_('https://www.forebet.com/x', 'https://api.scrape.do/?token=T&url=', false);
  eq(g.__seen[0].opt.headers['Authorization'], undefined);
  eq(g.__seen[0].opt.headers['X-Engine'], undefined);
  eq(g.__seen[0].opt.headers['X-Return-Format'], undefined);
});

test('jina ยังต่อแบบเดิม (ไม่เข้ารหัส)', () => {
  const g = env({});
  g.cpGet_('https://www.forebet.com/x?a=1', 'https://r.jina.ai/', false);
  eq(g.__seen[0].url, 'https://r.jina.ai/https://www.forebet.com/x?a=1');
  eq(g.__seen[0].opt.headers['X-Return-Format'], 'html');
});

test('ScrapingAnt ห่อฟีดด้วย <html><body> → cpGet_ ต้องแกะออกให้เหลือ [[...]]', () => {
  const g = loadGas(['gas/Config.gs', 'gas/Compat.gs'], {
    UrlFetchApp: { fetch: () => fakeResponse(200, '<html><head></head><body>[[{"id":"1","a":"x &amp; y"}]]</body></html>') }
  });
  const r = g.cpGet_('https://www.forebet.com/x', 'https://api.scrapingant.com/v2/general?url=', false);
  eq(r.body, '[[{"id":"1","a":"x & y"}]]');
});

test('หน้า HTML ธรรมดา (ไม่ใช่ฟีด) ต้องไม่ถูกแตะ', () => {
  const html = '<html><head></head><body><div>hi</div></body></html>';
  const g = loadGas(['gas/Config.gs', 'gas/Compat.gs'], {
    UrlFetchApp: { fetch: () => fakeResponse(200, html) }
  });
  eq(g.cpGet_('https://www.forebet.com/x', '', false).body, html);
});
