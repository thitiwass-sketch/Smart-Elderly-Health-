# ⌚ Smart Elderly Health Watch

**Smart Elderly Health Watch** คือระบบติดตามและประมวลผลข้อมูลสุขภาพผู้สูงอายุอัจฉริยะ ออกแบบมาเพื่อช่วยในการเฝ้าระวัง แสดงผลข้อมูลสุขภาพ และเพิ่มความปลอดภัยให้กับผู้สูงอายุ

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

* **Frontend Framework:** [React](https://react.dev/) + [Vite](https://vitejs.dev/) (`vite.config.ts`)
* **Language:** [TypeScript](https://www.typescriptlang.org/) (99.6%)
* **Runtime & Package Manager:** [Bun](https://bun.sh/) (`bun.lock`)
* **Backend / Server:** TypeScript (`server.ts`)

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```text
Smart-Elderly-Health-/
├── public/             # โฟลเดอร์จัดเก็บ Static Assets และรูปภาพ
├── src/                # ซอร์สโค้ดหลักของแอปพลิเคชัน (React Components, Logic, Style)
├── bun.lock            # ไฟล์ Lock dependencies ของ Bun
├── index.html          # ไฟล์ HTML หลักสำหรับเว็บแอปพลิเคชัน
├── metadata.json       # ไฟล์ข้อมูล Metadata ของโปรเจกต์
├── package.json        # รายชื่อ Dependencies และ Scripts การใช้งาน
├── server.ts           # ไฟล์เซิร์ฟเวอร์หลัก (TypeScript Server)
├── tsconfig.json       # การตั้งค่าตัวแปลภาษา TypeScript
└── vite.config.ts      # การตั้งค่า Build และ Dev Server ของ Vite
```

---

## 🚀 การติดตั้งและเริ่มใช้งาน (Getting Started)

### 1. ความต้องการของระบบ (Prerequisites)
เครื่องคอมพิวเตอร์ต้องมีการติดตั้ง **Bun** เรียบร้อยแล้ว:
```bash
curl -fsSL https://bun.sh/install | bash
```

### 2. ดาวน์โหลดโปรเจกต์ (Clone Repository)
```bash
git clone https://github.com/thitiwass-sketch/Smart-Elderly-Health-.git
cd Smart-Elderly-Health-
```

### 3. ติดตั้ง Dependencies
```bash
bun install
```

### 4. การรันโปรเจกต์ (Running the Project)

* **รัน Development Server (Vite):**
  ```bash
  bun run dev
  ```

* **รัน Backend Server:**
  ```bash
  bun server.ts
  ```

* **การ Build โปรเจกต์สำหรับ Production:**
  ```bash
  bun run build
  ```

---

## 👥 ผู้พัฒนา (Contributors)

* **Thitiwass** ([@thitiwass-sketch](https://github.com/thitiwass-sketch))

---

## 📄 License

จัดทำขึ้นสำหรับโปรเจกต์ **Smart Elderly Health Watch**
