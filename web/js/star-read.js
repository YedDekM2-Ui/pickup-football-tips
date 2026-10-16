/* star-read.js — อ่านรูปดวงจากแอป "ปฏิทินโหร 100 ปี รายวัน" ในเครื่องเอง (ไม่ต้องมีคีย์ ไม่ยิงเน็ต)
   ไหลงาน: หาเส้นตารางกลาง 2 แนวตั้ง/2 แนวนอน → รู้จุดศูนย์กลาง+ขนาดดวง
           ลบเส้นตาราง/เส้นทแยง/วงกลมทิ้ง → เหลือแต่ตัวเลข → ตัดเป็นก้อน
           เทียบก้อนกับแม่แบบ (ฝึกจากรูปจริงของเจ้าของ) → ใส่ราศีตามตำแหน่ง
   ใช้ได้ทั้งในเบราว์เซอร์ (canvas ImageData) และ node (เทสต์) — รับ {width,height,data RGBA}
   ⚠️ อ่านพลาดได้ — ผลทุกครั้งต้องโชว์ในตารางแก้ได้ก่อนบันทึก ห้ามบันทึกเอง */
'use strict';

/* ราศีเรียงตามจักรราศี 0..11 */
var SR_RASI = ['เมษ', 'พฤษภ', 'เมถุน', 'กรกฎ', 'สิงห์', 'กันย์', 'ตุลย์', 'พิจิก', 'ธนู', 'มังกร', 'กุมภ์', 'มีน'];
var SR_GW = 12, SR_GH = 16;   /* ขนาดตารางย่อที่ใช้เทียบแม่แบบ */

function srLum_(d, i) { return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; }

/** พิกเซลสว่าง (ตัวอักษรขาว/ฟ้า/เหลือง บนพื้นดำ) */
function srBright_(d, i) {
  var r = d[i], g = d[i + 1], b = d[i + 2];
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return srLum_(d, i) > 105 || (mx > 120 && mx - mn > 60);
}

/** สีของก้อน: ฟ้า = ดาวสถานะพิเศษ · เหลือง = ดาวย้ายวันนี้ · ขาว = ปกติ */
function srColor_(r, g, b) {
  if (b > r + 40 && b > 120) return 'ฟ้า';
  if (r > 150 && g > 130 && b < r - 60) return 'เหลือง';
  return 'ขาว';
}

/** หาเส้นยาวที่สุด 2 เส้นตามแนว (แกนตั้ง axis='x' → คืนพิกัด x ของเส้นตั้ง) */
function srLines_(img, axis) {
  var W = img.width, H = img.height, d = img.data;
  var n = axis === 'x' ? W : H, best = [];
  var aLo = axis === 'x' ? Math.floor(H * 0.2) : Math.floor(W * 0.05);
  var aHi = axis === 'x' ? Math.floor(H * 0.9) : Math.floor(W * 0.95);
  for (var k = 0; k < n; k++) {
    var run = 0, gap = 0, mx = 0;
    for (var t = aLo; t < aHi; t++) {
      var x = axis === 'x' ? k : t, y = axis === 'x' ? t : k;
      if (srBright_(d, (y * W + x) * 4)) { run += 1 + gap; gap = 0; if (run > mx) mx = run; }
      else if (run > 0 && gap < 2) gap++;
      else { run = 0; gap = 0; }
    }
    best.push(mx);
  }
  var top = 0; for (k = 0; k < n; k++) if (best[k] > top) top = best[k];
  var groups = [], cur = null;
  for (k = 0; k < n; k++) {
    /* เกณฑ์ตายตัวตามขนาดรูป ไม่เทียบกับเส้นยาวสุด — ขอบการ์ด/เส้นคั่นยาวกว่าเส้นดวงได้ */
    if (best[k] >= (aHi - aLo) * 0.15) {
      if (cur && k - cur.e <= 2) { cur.e = k; cur.s2 += k * best[k]; cur.w += best[k]; cur.len = Math.max(cur.len, best[k]); }
      else { cur = { s: k, e: k, s2: k * best[k], w: best[k], len: best[k] }; groups.push(cur); }
    }
  }
  var cand = groups.map(function (g) { return { pos: g.s2 / g.w, len: g.len }; });
  var big = cand.filter(function (c) { return c.len >= top * 0.75; }).sort(function (a, b) { return b.len - a.len; });
  var two = big.slice(0, 2).map(function (c) { return c.pos; }).sort(function (a, b) { return a - b; });
  return { lines: two, len: top, cand: cand };
}

/** เลือกคู่เส้นตั้ง+คู่เส้นนอนที่เป็นช่องกลางดวงจริง: ช่องกลางเป็นจัตุรัส (ระยะห่าง 2 คู่เท่ากัน)
    และเส้นทั้ง 4 ยาวพอๆ กัน (เป็นคอร์ดของวงเดียวกัน) — กันเส้นอื่นบนจอที่ยาวกว่ามาแย่งที่
    เจอจริง 16 ต.ค. 69: รูปต้นฉบับไอโฟน เส้นคั่นใต้ "ขึ้น ๔ ค่ำ" ยาว 754 สว่างกว่าเส้นดวง (523) */
function srPickSquare_(vx, hy) {
  var best = null, i, j, a, b;
  var pairs = function (c) {
    var out = [];
    for (i = 0; i < c.length; i++) for (j = i + 1; j < c.length; j++) {
      var gap = Math.abs(c[j].pos - c[i].pos);
      if (gap < 30) continue;
      var la = c[i].len, lb = c[j].len;
      if (Math.min(la, lb) < Math.max(la, lb) * 0.85) continue;
      out.push({ p1: Math.min(c[i].pos, c[j].pos), p2: Math.max(c[i].pos, c[j].pos), gap: gap, len: (la + lb) / 2 });
    }
    return out;
  };
  var X = pairs(vx.cand || []), Y = pairs(hy.cand || []);
  for (a = 0; a < X.length; a++) for (b = 0; b < Y.length; b++) {
    var gx = X[a].gap, gy = Y[b].gap;
    if (Math.abs(gx - gy) > 0.12 * Math.max(gx, gy)) continue;
    if (Math.min(X[a].len, Y[b].len) < Math.max(X[a].len, Y[b].len) * 0.85) continue;
    var sc = X[a].len + Y[b].len;
    if (!best || sc > best.sc) best = { sc: sc, x: X[a], y: Y[b] };
  }
  return best;
}

/** เรขาคณิตของดวง: เส้นตาราง x1,x2,y1,y2 · ศูนย์กลาง · รัศมี */
function srGeom_(img) {
  var vx = srLines_(img, 'x'), hy = srLines_(img, 'y');
  var sq = srPickSquare_(vx, hy);
  if (!sq) return null;
  var x1 = sq.x.p1, x2 = sq.x.p2, y1 = sq.y.p1, y2 = sq.y.p2;
  var s = ((x2 - x1) + (y2 - y1)) / 2;
  if (s < 30) return null;
  /* เส้นตารางยาวเท่าคอร์ดของวงกลมพอดี → รัศมี = sqrt((len/2)^2 + (s/2)^2) */
  var half = Math.max(sq.x.len, sq.y.len) / 2;
  var R = Math.sqrt(half * half + (s / 2) * (s / 2));
  var g = { x1: x1, x2: x2, y1: y1, y2: y2, s: s, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, R: R - 4 };
  g.diag = srDiags_(img, g);
  return g;
}

/** เส้นทแยง 4 เส้นออกจากมุมช่องกลาง — มุมไม่ใช่ 45° พอดี (วัดจริงได้ ~47°) จึงต้องหาเอง
    ลองทุกมุม 30–60° เลือกมุมที่มีพิกเซลสว่างตามแนวมากสุด */
function srDiags_(img, g) {
  var W = img.width, H = img.height, d = img.data, out = [];
  var cs = [[g.x1, g.y1, -1, -1], [g.x2, g.y1, 1, -1], [g.x1, g.y2, -1, 1], [g.x2, g.y2, 1, 1]];
  cs.forEach(function (c) {
    var best = { n: -1, ux: 0, uy: 0 };
    for (var a = 30; a <= 60; a += 0.5) {
      var rad = a * Math.PI / 180, ux = Math.cos(rad) * c[2], uy = Math.sin(rad) * c[3], n = 0;
      for (var t = g.s * 0.15; t < g.R - g.s * 0.5; t += 1) {
        var x = Math.round(c[0] + ux * t), y = Math.round(c[1] + uy * t);
        if (x < 0 || y < 0 || x >= W || y >= H) break;
        if (srBright_(d, (y * W + x) * 4)) n++;
      }
      if (n > best.n) best = { n: n, ux: ux, uy: uy };
    }
    out.push({ x: c[0], y: c[1], ux: best.ux, uy: best.uy });
  });
  return out;
}

/** ตำแหน่ง → ราศี (0..11) · -1 = อยู่ในช่องกลาง */
function srRasiAt_(g, x, y) {
  var col = x < g.x1 ? 0 : (x > g.x2 ? 2 : 1);
  var row = y < g.y1 ? 0 : (y > g.y2 ? 2 : 1);
  if (row === 0 && col === 1) return 0;
  if (row === 1 && col === 0) return 3;
  if (row === 1 && col === 2) return 9;
  if (row === 2 && col === 1) return 6;
  if (row === 1 && col === 1) return -1;
  var cx = col === 0 ? g.x1 : g.x2, cy = row === 0 ? g.y1 : g.y2;
  var vert = Math.abs(y - cy) > Math.abs(x - cx);   /* ใกล้ขอบบน/ล่าง มากกว่าขอบข้าง */
  if (row === 0 && col === 0) return vert ? 1 : 2;
  if (row === 0 && col === 2) return vert ? 11 : 10;
  if (row === 2 && col === 2) return vert ? 7 : 8;
  return vert ? 5 : 4;                                /* ล่างซ้าย */
}

/** พิกเซลนี้เป็นเส้นของดวง (ไม่ใช่ตัวเลข) ไหม */
function srOnLine_(g, x, y) {
  var t = Math.max(2.5, g.s * 0.03);
  var dx = x - g.cx, dy = y - g.cy, dist = Math.sqrt(dx * dx + dy * dy);
  if (Math.abs(dist - g.R) <= t + 3) return true;
  if (Math.abs(x - g.x1) <= t || Math.abs(x - g.x2) <= t) {
    if (y < g.y1 - t || y > g.y2 + t || (y >= g.y1 - t && y <= g.y2 + t)) return true;
  }
  if (Math.abs(y - g.y1) <= t || Math.abs(y - g.y2) <= t) return true;
  /* เส้นทแยงออกจากมุมช่องกลาง 4 มุม */
  for (var i = 0; i < 4; i++) {
    var L = g.diag[i], px = x - L.x, py = y - L.y;
    var along = px * L.ux + py * L.uy, perp = Math.abs(px * L.uy - py * L.ux);
    if (along >= -t && perp <= t * 1.1) return true;
  }
  return false;
}

/** ตัดก้อนตัวอักษรภายในวงกลม (นอกเส้น) — คืน [{x0,y0,x1,y1,px:[[x,y]],col}] */
function srBlobs_(img, g) {
  var W = img.width, H = img.height, d = img.data;
  var xa = Math.max(0, Math.floor(g.cx - g.R)), xb = Math.min(W - 1, Math.ceil(g.cx + g.R));
  var ya = Math.max(0, Math.floor(g.cy - g.R)), yb = Math.min(H - 1, Math.ceil(g.cy + g.R));
  var bw = xb - xa + 1, bh = yb - ya + 1;
  var on = new Uint8Array(bw * bh), seen = new Uint8Array(bw * bh);
  for (var y = ya; y <= yb; y++) {
    for (var x = xa; x <= xb; x++) {
      var dx = x - g.cx, dy = y - g.cy;
      if (dx * dx + dy * dy > (g.R - 3) * (g.R - 3)) continue;
      if (!srBright_(d, (y * W + x) * 4)) continue;
      if (srOnLine_(g, x, y)) continue;
      on[(y - ya) * bw + (x - xa)] = 1;
    }
  }
  var out = [];
  for (var i = 0; i < on.length; i++) {
    if (!on[i] || seen[i]) continue;
    var st = [i], px = [], x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, sr = 0, sg = 0, sb = 0;
    seen[i] = 1;
    while (st.length) {
      var c = st.pop(), cx = c % bw, cy = (c - cx) / bw, X = cx + xa, Y = cy + ya;
      px.push([X, Y]);
      var q = (Y * W + X) * 4; sr += d[q]; sg += d[q + 1]; sb += d[q + 2];
      if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
      for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
        var nx = cx + ox, ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
        var ni = ny * bw + nx;
        if (on[ni] && !seen[ni]) { seen[ni] = 1; st.push(ni); }
      }
    }
    if (px.length < g.s * 0.12 || (y1 - y0) < g.s * 0.07) continue;   /* ฝุ่น/เศษเส้น */
    out.push({ x0: x0, y0: y0, x1: x1, y1: y1, px: px, col: srColor_(sr / px.length, sg / px.length, sb / px.length) });
  }
  /* ก้อนที่ซ้อนกัน (ตัวอักษรขาดเป็น 2 ชิ้น) รวมเป็นก้อนเดียว */
  var merged = true;
  while (merged) {
    merged = false;
    for (var a = 0; a < out.length && !merged; a++) for (var b = a + 1; b < out.length && !merged; b++) {
      var A = out[a], B = out[b];
      var ox2 = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0), oy2 = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
      /* รวมเฉพาะก้อนที่ทับกันจริงเกินครึ่ง — แค่กรอบเฉียดกัน (เช่น 4 กับ / ใน "14/32") ห้ามรวม */
      var aA = (A.x1 - A.x0 + 1) * (A.y1 - A.y0 + 1), aB = (B.x1 - B.x0 + 1) * (B.y1 - B.y0 + 1);
      if (ox2 > 0 && oy2 > 0 && ox2 * oy2 > 0.5 * Math.min(aA, aB)) {
        A.x0 = Math.min(A.x0, B.x0); A.y0 = Math.min(A.y0, B.y0);
        A.x1 = Math.max(A.x1, B.x1); A.y1 = Math.max(A.y1, B.y1);
        A.px = A.px.concat(B.px); out.splice(b, 1); merged = true;
      }
    }
  }
  return out;
}

/** หมุนก้อนรอบจุดกลาง (องศา) — แอปต้นทางเขียนตัวเลขเอียงตามเส้นทแยงเวลาช่องมุมมีดาวเยอะ */
function srRot_(b, deg) {
  if (!deg) return b;
  var r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  var mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  var px = b.px.map(function (p) {
    var dx = p[0] - mx, dy = p[1] - my, X = Math.round(mx + dx * c - dy * s), Y = Math.round(my + dx * s + dy * c);
    if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
    return [X, Y];
  });
  return { x0: x0, y0: y0, x1: x1, y1: y1, px: px };
}

/** ระยะที่ใกล้สุดของแต่ละตัวอักษร {ch: dist} — ใช้ตอนแก้เลขซ้ำ */
function srScores_(b, templates) {
  var out = {};
  [0, -15, 15, -30, 30, -45, 45].forEach(function (a) {
    var f = srFeat_(srRot_(b, a));
    (templates || []).forEach(function (t) {
      var d = srDist_(f, t.f) + Math.abs(a) / 60;
      if (out[t.ch] === undefined || d < out[t.ch]) out[t.ch] = d;
    });
  });
  return out;
}

/** เทียบแม่แบบแบบหมุนได้: ตรงๆ ก่อน ถ้ายังไม่สนิทค่อยลองหมุน ±15..±60° (หักคะแนนมุมนิดหน่อย กันหมุนมั่ว) */
function srClassifyBlob_(b, templates) {
  var best = srClassify_(srFeat_(b), templates);
  if (best.dist <= 2.2) return best;
  [-15, 15, -30, 30, -45, 45, -60, 60].forEach(function (a) {
    var c = srClassify_(srFeat_(srRot_(b, a)), templates);
    c.dist += Math.abs(a) / 60;
    if (c.dist < best.dist) best = c;
  });
  return best;
}

/** ก้อน → เวกเตอร์ลักษณะ (ตาราง 12x16 ความหนาแน่น + สัดส่วนกว้าง/สูง) */
function srFeat_(b) {
  var w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1, f = [], i;
  for (i = 0; i < SR_GW * SR_GH; i++) f.push(0);
  b.px.forEach(function (p) {
    var gx = Math.min(SR_GW - 1, Math.floor((p[0] - b.x0) / w * SR_GW));
    var gy = Math.min(SR_GH - 1, Math.floor((p[1] - b.y0) / h * SR_GH));
    f[gy * SR_GW + gx]++;
  });
  var cell = (w / SR_GW) * (h / SR_GH);
  for (i = 0; i < f.length; i++) f[i] = Math.min(1, f[i] / Math.max(1, cell));
  f.push((w / h) * 3);
  return f;
}

function srDist_(a, b) {
  var s = 0;
  for (var i = 0; i < a.length; i++) { var t = a[i] - b[i]; s += t * t; }
  return Math.sqrt(s);
}

/** เทียบแม่แบบ → {ch, dist} */
function srClassify_(feat, templates) {
  var best = { ch: '?', dist: 1e9 };
  (templates || []).forEach(function (t) {
    var dd = srDist_(feat, t.f);
    if (dd < best.dist) best = { ch: t.ch, dist: dd };
  });
  return best;
}

/**
 * อ่านรูปดวง → {ok, rasi:[[ตัวเลข]x12], lagna, center:{a,b}, special:{ฟ้า:[],เหลือง:[]}, unsure:n, geom}
 * ดาว: '0'..'9' · ลัคนา: 'ล'
 */
function starRead(img, templates) {
  var g = srGeom_(img);
  if (!g) return { ok: false, error: 'หาตารางดวงในรูปไม่เจอ — ต้องเป็นรูปหน้าจอ "ปฏิทินโหร 100 ปี รายวัน"' };
  var blobs = srBlobs_(img, g);
  var rasi = [], i;
  for (i = 0; i < 12; i++) rasi.push([]);
  var mid = [], lagna = -1, unsure = 0, blue = [], yellow = [];
  blobs.forEach(function (b) {
    var bx = (b.x0 + b.x1) / 2, by = (b.y0 + b.y1) / 2;
    var r = srRasiAt_(g, bx, by);
    var c = srClassifyBlob_(b, templates);
    b.ch = c.ch; b.dist = c.dist; b.cx = bx; b.cy = by; b.r = r;
    if (c.dist > 3.2) unsure++;
    if (r < 0) { mid.push(b); return; }
    if (c.ch === 'ล') { lagna = r; return; }
    if (!/^[0-9]$/.test(c.ch)) { unsure++; return; }
    rasi[r].push(b);
    if (b.col === 'ฟ้า') blue.push(c.ch);
    if (b.col === 'เหลือง') yellow.push(c.ch);
  });
  /* ด่านกันรูปผิดแอป: ดวงจริงมีดาว 10 ดวงไม่ซ้ำ — ได้เกิน 12 ก้อน หรือซ้ำกันเกิน 2 ตัว = ไม่ใช่หน้าดวงของปฏิทินโหร
     (เจอจริง 16 ต.ค. 69: ภาพหน้าจอของแกะดาวเอง มีวงดวงคล้ายกัน อ่านออกมาเป็นดาว 26 ดวงมั่วๆ) */
  var cnt = 0, rep = 0, seenD = {};
  rasi.forEach(function (l) { l.forEach(function (b) { cnt++; if (seenD[b.ch]) rep++; seenD[b.ch] = 1; }); });
  if (cnt > 12 || rep > 2 || cnt < 5) {
    return { ok: false, error: 'รูปนี้ไม่ใช่หน้าดวงของแอป "ปฏิทินโหร 100 ปี รายวัน" (เจอตัวเลข ' + cnt + ' ตัว ซ้ำ ' + rep + ')', geom: g };
  }

  /* ดาวแต่ละดวงอยู่ได้ที่เดียว: อ่านได้เลขซ้ำแต่มีเลขที่ขาด = ตัวหนึ่งอ่านผิดแน่
     ย้ายตัวที่ "เสียน้อยสุด" ถ้าเปลี่ยนเป็นเลขที่ขาด (เจอจริง: ๔ เอียงแรง อ่านเป็น ๕) */
  var guard = 0;
  while (guard++ < 10) {
    var all = [], have = {};
    rasi.forEach(function (l) { l.forEach(function (b) { all.push(b); have[b.ch] = (have[b.ch] || 0) + 1; }); });
    var dupCh = Object.keys(have).filter(function (k) { return have[k] > 1; });
    var miss = '0123456789'.split('').filter(function (k) { return !have[k]; });
    if (!dupCh.length || !miss.length) break;
    var pick = null;
    all.forEach(function (b) {
      if (dupCh.indexOf(b.ch) < 0) return;
      if (!b.sc) b.sc = srScores_(b, templates);
      miss.forEach(function (m) {
        var cost = (b.sc[m] === undefined ? 99 : b.sc[m]) - b.dist;
        if (!pick || cost < pick.cost) pick = { b: b, m: m, cost: cost };
      });
    });
    if (!pick || pick.cost > 4) break;
    pick.b.ch = pick.m; pick.b.fixed = true; unsure++;
  }

  /* เรียงในช่อง: ช่องที่เรียงแนวตั้งอ่านบน→ล่าง ไม่งั้นซ้าย→ขวา */
  var cells = rasi.map(function (list) {
    if (list.length < 2) return list.map(function (b) { b.k = 0; return b.ch; });
    var xs = list.map(function (b) { return b.cx; }), ys = list.map(function (b) { return b.cy; });
    var vert = (Math.max.apply(null, ys) - Math.min.apply(null, ys)) > (Math.max.apply(null, xs) - Math.min.apply(null, xs));
    list.sort(function (a, b) { return vert ? a.cy - b.cy : a.cx - b.cx; });
    list.forEach(function (b, k) { b.k = k; });
    return list.map(function (b) { return b.ch; });
  });
  /* เลขกลางดวง "14/32": แบ่งด้วยเครื่องหมาย / — ซ้ายบน = a · ขวาล่าง = b */
  var center = { a: '', b: '' };
  var slash = mid.filter(function (b) { return b.ch === '/'; })[0];
  var digs = mid.filter(function (b) { return /^[0-9]$/.test(b.ch); });
  digs.sort(function (p, q) { return p.cx - q.cx; });
  digs.forEach(function (b) {
    var top = slash ? (b.cx + (b.cy - slash.cy) * 0 < slash.cx && b.cy < slash.cy + 2) : b.cy < g.cy;
    if (top) center.a += b.ch; else center.b += b.ch;
  });
  /* ตัวที่ไม่ชัวร์ = ต้องถามเจ้าของ (เจ้าของสั่ง 16 ต.ค. 69: "เจอแบบนี้บังคับให้ถามฉันได้เลย")
     ไม่ชัวร์ = ถูกแก้เพราะเลขซ้ำ · ห่างแม่แบบมาก · หรือเลขอันดับ 2 ใกล้กันเกินไป (เช่น ๔ กับ ๕) */
  var ask = [];
  rasi.forEach(function (list, r) {
    list.forEach(function (b) {
      if (!b.sc) b.sc = srScores_(b, templates);
      var order = Object.keys(b.sc).filter(function (k) { return /^[0-9]$/.test(k); })
        .sort(function (p, q) { return b.sc[p] - b.sc[q]; });
      var margin = order.length > 1 ? b.sc[order[1]] - b.sc[order[0]] : 9;
      if (b.fixed || b.dist > 3 || margin < 0.6) {
        ask.push({ r: r, k: b.k, ch: b.ch, alt: order.slice(0, 3), why: b.fixed ? 'อ่านได้เลขซ้ำ แอปเดาแก้ให้' : (b.dist > 3 ? 'ไม่เหมือนแม่แบบตัวไหนเลย' : 'ก้ำกึ่ง ' + order[0] + ' กับ ' + order[1]),
                   x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
      }
    });
  });
  return { ok: true, rasi: cells, lagna: lagna, center: center, ask: ask,
           special: { 'ฟ้า': blue, 'เหลือง': yellow }, unsure: unsure, geom: g,
           blobs: blobs.map(function (b) { return { ch: b.ch, r: b.r, x: Math.round(b.cx), y: Math.round(b.cy), d: Math.round(b.dist * 100) / 100, col: b.col, fixed: !!b.fixed }; }) };
}

if (typeof module !== 'undefined') {
  module.exports = { starRead: starRead, srGeom_: srGeom_, srLines_: srLines_, srPickSquare_: srPickSquare_, srBlobs_: srBlobs_, srFeat_: srFeat_,
                     srRasiAt_: srRasiAt_, srClassify_: srClassify_, srClassifyBlob_: srClassifyBlob_, srRot_: srRot_, SR_RASI: SR_RASI };
}
