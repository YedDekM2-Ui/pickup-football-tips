/* fmt.js — แปลงตัวเลข/เวลาเป็นข้อความสำหรับหน้าจอ
   กฎ: เวลาทุกตัวคิดเป็น UTC+7 เสมอ ไม่พึ่ง timezone ของเครื่อง
        ราคา/แฮนดิแคป/สกอร์ ห้ามปัดทิ้ง */
'use strict';

var TH_MONTH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
var TZ_MS = 7 * 60 * 60 * 1000;

/** คืน Date ที่เลื่อนไป UTC+7 แล้ว — ต้องอ่านค่าด้วย getUTC* เท่านั้น */
function thShift_(iso) {
  if (iso === null || iso === undefined || iso === '') return null;
  var t = Date.parse(iso);
  if (isNaN(t)) return null;
  return new Date(t + TZ_MS);
}

function pad2_(n) { return (n < 10 ? '0' : '') + n; }

function fmtMoney(n) {
  var v = Number(n);
  if (isNaN(v)) return '0.00';
  var neg = v < 0;
  var s = Math.abs(v).toFixed(2);
  var parts = s.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + parts[0] + '.' + parts[1];
}

function fmtSigned(n) {
  var v = Number(n);
  if (isNaN(v)) return '0.00';
  return (v > 0 ? '+' : '') + fmtMoney(v);
}

function fmtHandicap(h) {
  var v = Number(h);
  if (isNaN(v)) return '';
  if (v === 0) return '0';
  var s = String(Math.abs(v));
  return (v > 0 ? '+' : '-') + s;
}

function fmtOdds(o) {
  var v = Number(o);
  if (isNaN(v)) return '';
  var dec = (String(v).split('.')[1] || '').length;
  return v.toFixed(Math.max(2, dec));
}

function thDate(iso) {
  var d = thShift_(iso);
  if (!d) return '';
  var be = d.getUTCFullYear() + 543;
  return d.getUTCDate() + ' ' + TH_MONTH[d.getUTCMonth()] + ' ' + String(be).slice(-2);
}

function thTime(iso) {
  var d = thShift_(iso);
  if (!d) return '';
  return pad2_(d.getUTCHours()) + ':' + pad2_(d.getUTCMinutes());
}

/** วัน-เวลาเตะแบบที่เจ้าของสั่ง: 27/8/2026  00:00
    ตรงนี้เป็นปี ค.ศ. (ไม่ใช่ พ.ศ. แบบ thDate) เพราะเจ้าของเขียนแบบนี้มาเอง
    ค่าที่ส่งมาเป็นเวลาไทยอยู่แล้ว (ฝั่ง GAS บวก +7 ให้ตอนดึง) ห้ามบวกซ้ำที่นี่
    รู้ไม่ครบ = โชว์เท่าที่รู้ ห้ามเดาวันที่ให้เอง */
function kickText(ymd, hm) {
  var d = String(ymd === null || ymd === undefined ? '' : ymd).trim();
  var t = String(hm === null || hm === undefined ? '' : hm).trim();
  var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(d);
  var day = m ? (Number(m[3]) + '/' + Number(m[2]) + '/' + m[1]) : '';
  if (day && t) return day + '  ' + t;
  return day || t;
}

/** สถานะมาก่อนเวลาเสมอ — จบแล้วก็คือจบ ไม่ว่านาฬิกาจะว่าอะไร */
function countdownText(iso, status, nowMs) {
  if (status === 'จบ') return 'จบการแข่งขัน';
  var t = Date.parse(iso);
  if (isNaN(t)) return '';
  if (status === 'สด') return 'สด';
  var left = t - Number(nowMs);
  if (left <= 0) return 'สด';
  var mins = Math.floor(left / 60000);
  var hrs = Math.floor(mins / 60);
  if (hrs > 0) return 'อีก ' + hrs + ' ชม. ' + (mins % 60) + ' น.';
  return 'อีก ' + mins + ' น.';
}
