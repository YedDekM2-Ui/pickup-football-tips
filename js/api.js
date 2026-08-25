/* api.js — ทางเดียวที่หน้าเว็บคุยกับเซิร์ฟเวอร์
   บทเรียนจาก TimeTrack: เปิดแอปต้องเห็นของทันที ห้ามรอเน็ต → อ่านแคชก่อนเสมอ */
'use strict';

var API_URL = 'https://script.google.com/macros/s/AKfycbzDNNda4bOOkcu0ashVFGIK7F3MoeSqGUBabMjvQVsVw_jaonJVKd8uKVmsn7admOqKcg/exec';
var CACHE_KEY = 'pickup.data.v1';
var KEY_STORE = 'pickup.key.v1';

/* กุญแจไม่เคยอยู่ในไฟล์นี้ (repo เป็น public) — รับจาก ?k= ตอนเปิดครั้งแรก แล้วจำไว้ในเครื่อง */
function keyFromUrl_() {
  var s = (typeof location !== 'undefined' && location.search) ? String(location.search) : '';
  var m = s.match(/[?&]k=([^&]*)/);
  return m ? decodeURIComponent(m[1]) : '';
}

function saveKey_(k) { try { localStorage.setItem(KEY_STORE, k); } catch (e) {} }
function loadKey_() { try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; } }

/** เปิดด้วยลิงก์ที่มีกุญแจ = จำไว้ แล้วลบออกจากแถบที่อยู่ทันที กันติดไปกับการแชร์ลิงก์ */
function bootKey_() {
  var k = keyFromUrl_();
  if (k) {
    saveKey_(k);
    try { history.replaceState(null, '', location.pathname + (location.hash || '')); } catch (e) {}
  }
  return k || loadKey_();
}

function saveCache(d) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), d: d })); }
  catch (e) { /* เครื่องไม่ให้เขียน ก็แค่ไม่มีแคช ไม่ต้องพัง */ }
}

function loadCache() {
  try {
    var raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    var o = JSON.parse(raw);
    return (o && o.d) ? o.d : null;
  } catch (e) { return null; }
}

function pickData(fresh, cached) {
  if (fresh && fresh.ok === true) return { data: fresh, source: 'สด' };
  if (fresh && fresh.needKey === true) {
    return { data: (cached && cached.ok === true) ? cached : MOCK, source: 'ต้องใส่กุญแจ' };
  }
  if (cached && cached.ok === true) return { data: cached, source: 'แคช' };
  return { data: MOCK, source: 'ตัวอย่าง' };
}

function staleNote(source, atMs) {
  if (source === 'สด') return 'ล่าสุด ' + thTime(new Date(Number(atMs)).toISOString());
  if (source === 'แคช') return 'ออฟไลน์ — ของที่จำไว้ล่าสุด';
  if (source === 'ต้องใส่กุญแจ') return 'ต้องใส่กุญแจก่อน — เปิดลิงก์ที่ลงท้าย ?k=... อีกครั้ง';
  return 'ข้อมูลตัวอย่าง — ยังไม่ได้ต่อเซิร์ฟเวอร์';
}

/** ป้ายสถานะบนหัวจอ — LIVE กระพริบแดงสลับขาว "เฉพาะตอนต่อเซิร์ฟเวอร์ได้จริง"
    ของเก่า/ของตัวอย่างต้องไม่ขึ้น LIVE เด็ดขาด ไม่งั้นราคาค้างจะดูเหมือนราคาสด */
function statusPill(source, atMs) {
  var live = (source === 'สด');
  var cls = live ? 'pill live' : 'pill off';
  var text = live ? 'LIVE' : (source === 'แคช' ? 'OFFLINE' :
             (source === 'ต้องใส่กุญแจ' ? 'NO KEY' : 'DEMO'));
  return '<span class="' + cls + '">' + text + '</span>' +
         '<span class="pill-note">' + staleNote(source, atMs) + '</span>';
  /* ข้อความทุกบรรทัดในนี้เขียนเองทั้งหมด ไม่มีของจากผู้ใช้ เลยไม่ต้อง esc_
     (esc_ อยู่คนละไฟล์ ไฟล์นี้ต้องเทสต์เดี่ยวได้) */
}

function fetchAll_() {
  var k = loadKey_() || keyFromUrl_();
  if (!API_URL || !k) return Promise.resolve(null);
  return fetch(API_URL + '?p=all&k=' + encodeURIComponent(k), { method: 'GET' })
    .then(function (r) { return r.json(); })
    .catch(function () { return null; });
}
