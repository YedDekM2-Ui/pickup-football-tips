/* api.js — ทางเดียวที่หน้าเว็บคุยกับเซิร์ฟเวอร์
   บทเรียนจาก TimeTrack: เปิดแอปต้องเห็นของทันที ห้ามรอเน็ต → อ่านแคชก่อนเสมอ */
'use strict';

var API_URL = 'https://script.google.com/macros/s/AKfycbzDNNda4bOOkcu0ashVFGIK7F3MoeSqGUBabMjvQVsVw_jaonJVKd8uKVmsn7admOqKcg/exec';
var CACHE_KEY = 'pickup.data.v1';

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
  if (cached && cached.ok === true) return { data: cached, source: 'แคช' };
  return { data: MOCK, source: 'ตัวอย่าง' };
}

function staleNote(source, atMs) {
  if (source === 'สด') return 'ล่าสุด ' + thTime(new Date(Number(atMs)).toISOString());
  if (source === 'แคช') return 'ออฟไลน์ — ของที่จำไว้ล่าสุด';
  return 'ข้อมูลตัวอย่าง — ยังไม่ได้ต่อเซิร์ฟเวอร์';
}

function fetchAll_() {
  if (!API_URL) return Promise.resolve(null);
  return fetch(API_URL + '?p=all', { method: 'GET' })
    .then(function (r) { return r.json(); })
    .catch(function () { return null; });
}
