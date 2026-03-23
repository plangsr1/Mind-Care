 🧠 Dru MindCare (แพลตฟอร์มดูแลสุขภาพจิต)

Dru MindCare เป็นแพลตฟอร์มเว็บแอปพลิเคชันสำหรับการดูแลสุขภาพจิตแบบครบวงจร ที่ช่วยให้ผู้ใช้งานสามารถประเมินสุขภาพจิตเบื้องต้น จดบันทึกอารมณ์ความรู้สึก ฟัง Podcast รับชมการถ่ายทอดสด (Live Stream) พูดคุยกับ AI และสามารถนัดหมายปรึกษาผู้เชี่ยวชาญ (จิตแพทย์/นักจิตวิทยา) ได้ในที่เดียว

## ✨ ฟีเจอร์หลัก (Key Features)

- **ระบบจัดการผู้ใช้ (Role-based Authentication):** รองรับผู้ใช้งาน 3 ระดับ ได้แก่ ผู้ใช้ทั่วไป (User), แพทย์ผู้เชี่ยวชาญ (Doctor), และผู้ดูแลระบบ (Admin)
- **แบบประเมินสุขภาพจิต (Mental Health Assessments):** ทำแบบประเมินเพื่อวิเคราะห์ระดับความเครียด/ซึมเศร้า พร้อมคำแนะนำเบื้องต้น
- **ไดอารี่อารมณ์ (Mood Journal):** บันทึกอารมณ์ความรู้สึกและเรื่องราวในแต่ละวัน พร้อมสรุปผลทางสถิติ
- **Podcast & Live Stream (WebRTC):** - คลังเนื้อหา Podcast เกี่ยวกับสุขภาพจิต
  - ระบบถ่ายทอดสด (Live Stream) ความหน่วงต่ำผ่านเทคโนโลยี Mediasoup และ Socket.io สำหรับแพทย์/แอดมินเพื่อพูดคุยกับผู้ใช้งาน
- **AI Chatbot:** ระบบพูดคุยให้คำปรึกษาเบื้องต้นด้วย AI (รองรับโดย Cohere AI)
- **ระบบนัดหมายและชำระเงิน:** จองคิวปรึกษาแพทย์ และชำระเงินออนไลน์อย่างปลอดภัยผ่าน Omise Payment Gateway

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

**Frontend (`/frontend`):**
- React.js (Vite)
- React Router DOM
- Mediasoup Client & Socket.io Client (สำหรับ WebRTC Stream)
- Axios (สำหรับจัดการ API)

**Backend (`/backend`):**
- Node.js & Express.js
- SQLite (ฐานข้อมูล) & sqlite3
- Mediasoup & Socket.io (สำหรับ Media Server)
- JWT (JSON Web Token) & Bcrypt (สำหรับการยืนยันตัวตน)
- Cohere AI API (สำหรับ AI Chat)
- Omise API (สำหรับระบบชำระเงิน)
- Multer (สำหรับการจัดการอัปโหลดไฟล์)

---

## 🚀 การติดตั้งและเปิดใช้งานโปรเจกต์ (Getting Started)

### สิ่งที่ต้องมีเบื้องต้น (Prerequisites)
- [Node.js](https://nodejs.org/) (แนะนำเวอร์ชัน 18.x ขึ้นไป)
- Git

### 1. การตั้งค่า Backend
ระบบ Backend จะประกอบไปด้วย 2 เซิร์ฟเวอร์หลักคือ **Main API Server** (Port 3001) และ **Media Server** (Port 4000)

1. เปิด Terminal เข้าไปที่โฟลเดอร์ Backend:
   ```bash
   cd backend
   npm install
   ```

2. สร้างไฟล์ `.env` ในโฟลเดอร์ `backend` และกำหนดค่าดังนี้ (ใส่คีย์ของคุณเอง):
   ```env
   PORT=3001
   JWT_SECRET=your_jwt_secret_key_here
   OMISE_SECRET_KEY=your_omise_secret_key_here
   COHERE_API_KEY=your_cohere_api_key_here
   ```

3. เปิดใช้งาน Backend Server (ต้องเปิด 2 Terminal ควบคู่กัน):
   - **Terminal ที่ 1 (Main API):**
     ```bash
     node server.js
     ```
   - **Terminal ที่ 2 (Media Server สำหรับระบบสตรีม):**
     ```bash
     node media-server.js
     ```

### 2. การตั้งค่า Frontend
ระบบ Frontend ใช้ Vite ทำงานที่ Port `5173`

1. เปิด Terminal ใหม่แล้วเข้าไปที่โฟลเดอร์ Frontend:
   ```bash
   cd frontend
   npm install
   ```

2. รัน Frontend Development Server:
   ```bash
   npm run dev
   ```

3. เปิดเว็บเบราว์เซอร์ไปที่ `http://localhost:5173` เพื่อเริ่มใช้งาน Dru MindCare ได้ทันที!

---

## 🗄️ โครงสร้างฐานข้อมูล (Database)
โปรเจกต์นี้ใช้ **SQLite** (`mindcare.db`) ซึ่งจะถูกสร้างตารางอัตโนมัติ (Auto-migration & Seeding) เมื่อรัน `server.js` ในครั้งแรก ประกอบด้วยข้อมูลสำคัญเช่น ข้อมูลผู้ใช้, ชุดคำถามแบบประเมิน, ผลการประเมิน, ไดอารี่อารมณ์ และการตั้งค่า Stream

---

## 👨‍💻 ผู้พัฒนา (Developer)
**นายศรีวิกร อินพรหม** มหาวิทยาลัยราชภัฏธนบุรี (Dhonburi Rajabhat University)
```
