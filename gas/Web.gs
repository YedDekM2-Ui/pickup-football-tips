/**
 * Web.gs — ค้นเว็บ (ย้ายมาจาก PIKTAX AbdulTools.gs)
 *
 *   Tavily (มีคีย์ = ได้บทสรุป) → ถ้าไม่ได้ ตกไป DuckDuckGo (ฟรี ไม่ต้องมีคีย์)
 *
 * ⚠️ ห้ามฝังกุญแจในไฟล์นี้เด็ดขาด
 *    ของเดิมใน PIKTAX เขียน TAVILY_KEY ไว้กลางโค้ดเป็นค่าสำรอง — คีย์ตัวนั้นถือว่าหลุดแล้ว
 *    ที่นี่อ่านจาก Script Property 'TAVILY_KEY' อย่างเดียว ไม่ตั้ง = ใช้ DuckDuckGo
 *
 * ⚠️ prefix wb* — ห้ามชนกับ fb* fs* tf* fv*
 */

function wbStrip_(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

/** คืน null เมื่อใช้ไม่ได้ (ไม่มีคีย์ / โควตาหมด / ล่ม) เพื่อให้ตัวเรียกตกไป DuckDuckGo */
function wbTavily_(query) {
  var key = prop_('TAVILY_KEY');
  if (!key) return null;
  try {
    var res = UrlFetchApp.fetch('https://api.tavily.com/search', {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + key },
      payload: JSON.stringify({ query: String(query), max_results: 5,
                                include_answer: true, search_depth: 'basic' }),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return null;
    var j = JSON.parse(res.getContentText());
    var out = [];
    if (j.answer) out.push('สรุป: ' + j.answer);
    (j.results || []).slice(0, 5).forEach(function (r, i) {
      out.push((i + 1) + '. ' + (r.title || '') +
               '\n   ' + wbStrip_(r.content).slice(0, 260) +
               '\n   ' + (r.url || ''));
    });
    return out.length ? out.join('\n') : null;
  } catch (e) { return null; }
}

function wbDdg_(query) {
  try {
    var res = UrlFetchApp.fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query),
      { muteHttpExceptions: true,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    var html = res.getContentText();
    var out = [], n = 0, m;
    var re = /result__a[^>]*>([\s\S]*?)<\/a>[\s\S]*?result__snippet[^>]*>([\s\S]*?)<\/a>/g;
    while ((m = re.exec(html)) && n < 6) {
      var title = wbStrip_(m[1]), snip = wbStrip_(m[2]);
      if (title) { out.push((n + 1) + '. ' + title + ' — ' + snip); n++; }
    }
    if (out.length) return out.join('\n');
    /* หน้าเต็มเปลี่ยนโครงเมื่อไหร่ ตัวแกะข้างบนพังทันที — หน้า lite ไม่มี HTML ให้พัง */
    var r2 = UrlFetchApp.fetch('https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(query),
      { muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
    return wbStrip_(r2.getContentText()).slice(0, 1500);
  } catch (e) { return 'ค้นเว็บไม่สำเร็จ: ' + e.message; }
}

function webSearch_(query) {
  if (!query) return 'ไม่มีคำค้น';
  var tv = wbTavily_(query);
  return tv ? tv : wbDdg_(query);
}
