# Command Delay Calculator — KMUTNB Ground Station (GitHub Pages + Actions)

เวอร์ชันนี้ **ไม่ใช้ Firebase หรือ cloud ที่ต้องผูกบัตรเครดิต** — ใช้แค่ 2 อย่างที่ฟรีจริงจาก GitHub:

- **GitHub Pages** — โฮสต์หน้าเว็บ static (HTML/CSS/JS) ฟรี
- **GitHub Actions** — รันสคริปต์ดึง TLE จาก CelesTrak (หลัก) / SatNOGS DB (สำรอง) ตามตารางเวลา
  แล้ว commit ผลลัพธ์กลับเข้า repo เป็นไฟล์ `data/tle.json` ให้หน้าเว็บอ่าน

ไม่มี server, ไม่มี database, ไม่ต้องผูกบัตรเครดิต ใช้ repo เดียวจบ

## โครงสร้างโปรเจกต์

```
.
├── .github/workflows/update-tle.yml   # cron ทุก 3 ชม. + ปุ่ม Run workflow เพื่อรีเฟรชทันที
├── scripts/fetch-tle.mjs               # ดึง TLE (CelesTrak -> SatNOGS DB fallback) เขียนลง data/tle.json
├── satellites.json                     # รายชื่อดาวเทียมที่ติดตาม — แก้ไฟล์นี้เพื่อเพิ่ม/ลบดาวเทียม
├── data/tle.json                       # ผลลัพธ์ล่าสุด (Actions commit ให้อัตโนมัติ) หน้าเว็บอ่านไฟล์นี้
├── index.html / style.css / app.js     # หน้าเว็บ (คำนวณ SGP4 ด้วย satellite.js ฝั่ง browser)
└── .nojekyll                            # บอก GitHub Pages ไม่ต้องรัน Jekyll build
```

## วิธีติดตั้ง (ไม่ต้องมี CLI ก็ทำได้ ผ่านเว็บ GitHub ล้วนๆ)

### 1. สร้าง repository

สร้าง repo ใหม่บน GitHub (public หรือ private ก็ได้ — public จะได้ Actions minutes ไม่จำกัดฟรี)
แล้วอัปโหลดไฟล์ทั้งหมดในโปรเจกต์นี้เข้าไป (ลาก-วางผ่านเว็บ หรือ `git push` ก็ได้)

```bash
git init
git add .
git commit -m "init: command delay calculator"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

### 2. เปิด GitHub Pages

Settings -> Pages -> Source: **Deploy from a branch** -> Branch: **main** / **root** -> Save

หน้าเว็บจะขึ้นที่ `https://<your-username>.github.io/<your-repo>/` ภายในไม่กี่นาที

### 3. ตรวจสอบสิทธิ์ของ Actions (ปกติเป็นค่าเริ่มต้นอยู่แล้ว)

Settings -> Actions -> General -> Workflow permissions -> เลือก **Read and write permissions**
(จำเป็นเพราะ workflow ต้อง commit ไฟล์ `data/tle.json` กลับเข้า repo)

### 4. รัน workflow ครั้งแรกด้วยตัวเอง

ไปที่แท็บ **Actions** -> เลือก workflow **Update TLE data** -> กด **Run workflow**
รอสัก 10–20 วินาที ระบบจะดึง TLE ของ KNACKSAT-2 และ KNACKSAT แล้ว commit `data/tle.json`
ให้อัตโนมัติ หลังจากนี้จะรันเองทุก 3 ชั่วโมงตลอดไปโดยไม่ต้องทำอะไรเพิ่ม

เปิดหน้าเว็บ (หรือกดปุ่ม "โหลดข้อมูลล่าสุด") เพื่อดูผล

## การเพิ่ม/ลบดาวเทียมที่ติดตาม

แก้ไฟล์ `satellites.json` เช่น เพิ่มดาวเทียมอีกดวง:

```json
[
  { "noradId": "67683", "name": "KNACKSAT-2", "tags": ["primary", "knacksat2"] },
  { "noradId": "43761", "name": "KNACKSAT", "tags": ["knacksat1"] },
  { "noradId": "25544", "name": "ISS (ZARYA)", "tags": [] }
]
```

`tags: ["primary"]` คือดวงที่หน้าเว็บจะเลือกให้อัตโนมัติเมื่อเปิดหน้าเว็บครั้งแรก — ใส่ได้ดวงเดียว
commit + push แล้วรอบถัดไปของ workflow จะดึง TLE ของดาวเทียมใหม่ให้เอง (หรือกด "Run workflow"
เพื่อไม่ต้องรอ)

## หมายเหตุสำคัญ

- **ทำไมต้อง commit ข้อมูลกลับเข้า repo แทนที่จะยิง API ตรงจากหน้าเว็บ**: CelesTrak และ
  SatNOGS DB ถูกเรียกจากฝั่ง GitHub Actions (server-side) ไม่ใช่จาก browser ของผู้ใช้ —
  เลี่ยงปัญหา CORS ไปเลย และไม่ต้องมี backend ให้ดูแล หน้าเว็บแค่โหลดไฟล์ static
  `data/tle.json` ที่อยู่โดเมนเดียวกัน
- **ปุ่ม "โหลดข้อมูลล่าสุด"** บนหน้าเว็บ แค่โหลดไฟล์ `data/tle.json` ที่คอมมิตไว้แล้วซ้ำ (เผื่อ
  แคชเก่าค้าง) มันไม่ได้สั่งให้ดึง TLE ใหม่จริง — การบังคับดึงใหม่ทันทีต้องไปกด "Run workflow"
  ที่แท็บ Actions (ต้อง login GitHub ในฐานะเจ้าของ/ผู้มีสิทธิ์ repo)
- **ความถี่ในการอัปเดต**: ทุก 3 ชั่วโมงตามค่า cron ใน workflow — แก้ค่า
  `cron: '0 */3 * * *'` ใน `.github/workflows/update-tle.yml` ได้ตามต้องการ (ขั้นต่ำที่
  GitHub รองรับคือทุก 5 นาที แต่ในทางปฏิบัติ GitHub อาจดีเลย์ตารางเวลาช่วงโหลดสูง โดยเฉพาะ
  repo แบบ private)
- **ถ้าดึง TLE ไม่สำเร็จรอบใดรอบหนึ่ง** (เช่น CelesTrak ล่มชั่วคราว) สคริปต์จะ **เก็บ TLE เก่า
  ที่เคยดึงสำเร็จไว้** แทนที่จะลบทิ้ง เพื่อไม่ให้หน้าเว็บใช้งานไม่ได้เพราะปัญหาชั่วคราวของ
  แหล่งข้อมูลภายนอก
- **พิกัด KMUTNB Ground Station** ในหน้าเว็บ (13.8203, 100.5133) เป็นค่าประมาณของวิทยาเขต
  บางซื่อ — แก้ให้ตรงกับตำแหน่งเสาอากาศจริงก่อนใช้งานจริง (แก้ในหน้าเว็บได้ตรงๆ ไม่ต้องแก้โค้ด)
- **NORAD ID ที่ยืนยันแล้ว**: KNACKSAT-2 = 67683, KNACKSAT (ดวงแรก) = 43761 — ตรวจสอบซ้ำได้ที่
  [SatNOGS DB](https://db.satnogs.org/) หรือ [CelesTrak](https://celestrak.org/)
- **ข้อจำกัดของการคำนวณ**: ระบบหาจุดที่ ground track (จุดใต้ดาวเทียม) ใกล้เป้าหมายที่สุด
  เท่านั้น ยังไม่รวมมุมเอียงกล้อง/attitude ของดาวเทียมหรือความหน่วงของระบบภาคพื้นจริง — ใช้
  เป็นค่าประมาณเบื้องต้นเพื่อวางแผน ก่อนตรวจสอบกับซอฟต์แวร์ควบคุมภารกิจจริงเสมอ

## ทดสอบในเครื่องตัวเอง (ทางเลือก)

```bash
node scripts/fetch-tle.mjs      # ต้องมี Node 18+ และเน็ตออกไป celestrak.org / db.satnogs.org ได้
python3 -m http.server 8000     # แล้วเปิด http://localhost:8000
```
