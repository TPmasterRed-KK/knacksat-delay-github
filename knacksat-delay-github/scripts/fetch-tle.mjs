// scripts/fetch-tle.mjs
// รันโดย GitHub Actions (Node 20 มี fetch() ในตัวอยู่แล้ว ไม่ต้องติดตั้งไลบรารีเพิ่ม)
// ดึง TLE จาก CelesTrak ก่อน ถ้าไม่สำเร็จค่อย fallback ไป SatNOGS DB
// ถ้าทั้งสองแหล่งล้มเหลว จะ "เก็บค่าล่าสุดที่เคยดึงได้" ไว้ ไม่ลบทิ้ง

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const SAT_LIST_PATH = 'satellites.json';
const OUT_PATH = 'data/tle.json';
const UA = 'KMUTNB-CommandDelayCalculator/1.0 (+github-actions)';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchFromCelestrak(noradId) {
  const url = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${encodeURIComponent(noradId)}&FORMAT=TLE`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`CelesTrak HTTP ${res.status}`);
  const text = (await res.text()).trim();
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 3 || !lines[1].startsWith('1 ') || !lines[2].startsWith('2 ')) {
    throw new Error('CelesTrak: ไม่พบข้อมูล TLE (อาจยังไม่เข้า catalog หรือ NORAD ID ผิด)');
  }
  return { name: lines[0], line1: lines[1], line2: lines[2], source: 'celestrak' };
}

async function fetchFromSatnogs(noradId) {
  const url = `https://db.satnogs.org/api/tle/?norad_cat_id=${encodeURIComponent(noradId)}&format=json`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`SatNOGS DB HTTP ${res.status}`);
  const arr = await res.json();
  if (!Array.isArray(arr) || arr.length === 0) throw new Error('SatNOGS DB: ไม่พบข้อมูล TLE สำหรับ NORAD ID นี้');
  const latest = arr.reduce((a, b) => (new Date(b.updated) > new Date(a.updated) ? b : a));
  const name = latest.tle0 ? String(latest.tle0).replace(/^0 /, '').trim() : `NORAD ${noradId}`;
  return { name, line1: latest.tle1, line2: latest.tle2, source: 'satnogs' };
}

async function main() {
  const satellites = JSON.parse(await readFile(SAT_LIST_PATH, 'utf8'));

  let existing = { satellites: {} };
  try {
    existing = JSON.parse(await readFile(OUT_PATH, 'utf8'));
  } catch {
    // ไฟล์ยังไม่เคยถูกสร้าง (รันครั้งแรก) — ไม่เป็นไร เริ่มจากค่าว่าง
  }

  const out = { generatedAt: new Date().toISOString(), satellites: {} };

  for (const sat of satellites) {
    const id = String(sat.noradId);
    const errors = [];
    let result = null;

    try {
      result = await fetchFromCelestrak(id);
    } catch (e) {
      errors.push(`celestrak: ${e.message}`);
      try {
        result = await fetchFromSatnogs(id);
      } catch (e2) {
        errors.push(`satnogs: ${e2.message}`);
      }
    }

    if (result) {
      out.satellites[id] = {
        noradId: id,
        name: sat.name || result.name,
        tags: sat.tags || [],
        line1: result.line1,
        line2: result.line2,
        source: result.source,
        fetchedAt: new Date().toISOString(),
      };
      console.log(`OK   ${id} — ${result.name} (${result.source})`);
    } else if (existing.satellites && existing.satellites[id]) {
      out.satellites[id] = existing.satellites[id];
      console.warn(`FAIL ${id} — เก็บ TLE เก่าไว้ (${errors.join(' | ')})`);
    } else {
      console.error(`FAIL ${id} — ยังไม่เคยมี TLE ที่ดึงสำเร็จมาก่อน (${errors.join(' | ')})`);
    }

    await sleep(1200); // เว้นจังหวะให้ API สาธารณะ
  }

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(out, null, 2) + '\n');
  console.log(`เขียน ${OUT_PATH} เรียบร้อย (${Object.keys(out.satellites).length} ดาวเทียม)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
