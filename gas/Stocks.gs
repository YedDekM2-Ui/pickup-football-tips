/**
 * Stocks.gs — /หุ้น (ย้ายมาจาก PIKTAX AbdulTools.gs · toolStocks_)
 *
 *   ของเดิมเป็น "เครื่องมือ" ที่กรรชัยเรียกเอง ที่นี่ทำเป็นคำสั่งตรงๆ ไม่ต้องผ่าน AI
 *   เพราะข้างในมันคือ "ค้นเว็บด้วยคำค้นสำเร็จรูป" อยู่แล้ว ไม่ได้ใช้สมองอะไร
 *
 * ⚠️ นี่คือ "ผลค้นเว็บ" ไม่ใช่คำแนะนำลงทุน — บรรทัดท้ายการ์ดต้องบอกไว้เสมอ
 * ⚠️ prefix st* — ห้ามชนกับ fb* fs* tf* fv* wb*
 */

/** วันนี้แบบไทย d/M/yyyy — ใส่ในคำค้นเพื่อกันผลลัพธ์เก่าค้างปี */
function stToday_() {
  return Utilities.formatDate(new Date(), TZ, 'd/M/yyyy');
}

function stIsGlobal_(market) {
  return /global|us|usa|nasdaq|dow|s&p|โลก|ต่างประเทศ|อเมริกา|สหรัฐ/i.test(String(market || ''));
}

function stQuery_(market) {
  return stIsGlobal_(market)
    ? 'หุ้นเด่นวันนี้ ตลาดหุ้นสหรัฐ หุ้นน่าสนใจ ' + stToday_()
    : 'หุ้นเด่นวันนี้ SET หุ้นน่าสนใจ ข่าวหุ้นไทย ' + stToday_();
}

function stocksText_(market) {
  var global = stIsGlobal_(market);
  var body = webSearch_(stQuery_(market));
  return '📈 หุ้นเด่นวันนี้ · ' + (global ? 'ตลาดสหรัฐ' : 'ตลาดไทย (SET)') +
         ' · ' + stToday_() + '\n\n' +
         truncate_(String(body || 'ไม่มีข้อมูล'), 3200) + '\n\n' +
         'ℹ️ นี่คือผลค้นเว็บ ไม่ใช่คำแนะนำลงทุน' +
         (global ? '' : '\nอยากดูตลาดสหรัฐ พิมพ์  /หุ้น us');
}
