/* Config.gs — ค่าคงที่ทั้งโปรเจกต์ ที่เดียว
   ห้ามมีกุญแจอะไรในไฟล์นี้ ทุกอย่างที่เป็นความลับอยู่ใน Script Properties */
var TZ = 'Asia/Bangkok';

var SHEETS = { PICKS: 'PICKS', BETS: 'BETS', TEAMS: 'TEAMS' };

var HEADERS = {
  PICKS: ['ID','วันที่','ช่อง','ลีก','ทีมเหย้า','ทีมเยือน','เวลาเตะ',
          'เดาผล','เดาสกอร์','เปอร์เซ็นต์','ราคา','สกอร์จริง','ถูกผิด','สร้างเมื่อ'],
  BETS:  ['ID','Parent_ID','Bill_Type','วันที่','ลีก','ทีมเหย้า','ทีมเยือน',
          'ทีมที่เลือก','คู่แข่ง','ตลาด','แฮนดิแคป','เส้น','ทายสกอร์','ราคา','เงิน',
          'เวลาเตะ','สถานะ','สกอร์เหย้า','สกอร์เยือน','ผล','กำไร',
          'Telegram_Message_ID','กุญแจกันซ้ำ','สร้างเมื่อ','อัปเดตเมื่อ'],
  TEAMS: ['ชื่ออังกฤษ','ชื่อไทย']
};

/* ช่องที่ต้องบังคับเป็นข้อความ ไม่งั้นชีตกิน 0 หน้า / แปลงเป็นวันที่เอง */
var TEXT_COLS = {
  PICKS: ['ID','วันที่','เวลาเตะ','เดาสกอร์','สกอร์จริง','สร้างเมื่อ'],
  BETS:  ['ID','Parent_ID','วันที่','เวลาเตะ','ทายสกอร์','กุญแจกันซ้ำ','สร้างเมื่อ','อัปเดตเมื่อ'],
  TEAMS: []
};

var RESULT = { WIN_FULL:'WIN_FULL', WIN_HALF:'WIN_HALF', PUSH:'PUSH',
               LOSS_HALF:'LOSS_HALF', LOSS_FULL:'LOSS_FULL' };
var STATUS = { WAIT:'รอเตะ', LIVE:'สด', DONE:'จบ' };

function prop_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}
