// d:\mind-care\backend\server.js

// --- Core Setup ---
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { CohereClientV2 } = require("cohere-ai");
const omise = require("omise")({
  // 💡 ต้องมี
  secretKey: process.env.OMISE_SECRET_KEY,
});
const axios = require("axios");
// --- New Imports for Auth & DB ---
const { db, dbGet, dbAll, dbRun } = require("./database.js"); // Import the database connection
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// --- Express App Setup ---
const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());

// 💡 (สำคัญ) ห่อหุ้ม db.all และ db.get ด้วย Promise
// เพื่อให้เราใช้ async/await กับ Promise.all ได้ง่ายขึ้น

// --- Helper function: จัดรูปแบบวันที่ ---
// (แปลง Object Date ของ JS ให้เป็น 'YYYY-MM-DD' ที่ SQLite ชอบ)
const formatDate = (date) => {
  return date.toISOString().split("T")[0];
};

// 💡 =========================================================
// 💡 ย้ายฟังก์ชัน Middleware ทั้งสองมาไว้ที่นี่ (ก่อน Route แรก)
// 💡 =========================================================
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null) return res.sendStatus(401); // ไม่มี Token

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // Token ไม่ถูกต้อง
    req.user = user;
    next();
  });
};

const verifyAdmin = (req, res, next) => {
  // ตรวจสอบว่า user (จาก token) เป็น admin
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ error: "Access denied. Admins only." });
  }
};
// 💡 --- ฟังก์ชันช่วยลบไฟล์ --- 💡
// (แปลง http://localhost... URL กลับไปเป็น path ในเครื่อง)
const deleteFileByUrl = (fileUrl) => {
  if (!fileUrl || !fileUrl.startsWith("http://localhost")) return;
  try {
    const url = new URL(fileUrl); // เช่น http://localhost:3001/uploads/media/file.mp4
    // url.pathname จะได้ /uploads/media/file.mp4
    const filePath = path.join(__dirname, "public", url.pathname);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("Deleted old file:", filePath);
    }
  } catch (e) {
    console.error("Error deleting file by URL:", fileUrl, e.message);
  }
};
// ----------------------------------------------------

// ⭐️ API ใหม่ที่รวมทุกอย่างและรองรับ Date Range ⭐️
// (ตอนนี้ Route นี้จะหา verifyToken และ verifyAdmin เจอแล้ว)
app.get("/api/dashboard/report", verifyToken, verifyAdmin, async (req, res) => {
  try {
    // 1. รับค่าวันที่จาก Query (ถ้าไม่ส่งมา ให้ใช้ 30 วันย้อนหลัง)
    const endDate = req.query.endDate
      ? new Date(req.query.endDate)
      : new Date();
    let startDate = new Date();
    if (req.query.startDate) {
      startDate = new Date(req.query.startDate);
    } else {
      startDate.setDate(endDate.getDate() - 29); // 30 วันรวมวันนี้
    }

    // 2. คำนวณ "ช่วงเวลาก่อนหน้า" (Previous Period)
    const durationMs = endDate.getTime() - startDate.getTime(); // ระยะเวลาที่เลือก (ms)
    const prevEndDate = new Date(startDate.getTime() - 86400000); // 1 วันก่อน startDate
    const prevStartDate = new Date(prevEndDate.getTime() - durationMs); // ย้อนไปเท่ากับระยะเวลาที่เลือก

    // 3. แปลงเป็น String 'YYYY-MM-DD'
    const currentStartStr = formatDate(startDate);
    const currentEndStr = formatDate(endDate);
    const prevStartStr = formatDate(prevStartDate);
    const prevEndStr = formatDate(prevEndDate);

    // --- 4. สร้าง Query สำหรับแต่ละส่วน ---

    // Query สถิติในช่วงวันที่ที่เลือก (Current)
    const sqlCurrent = `
            SELECT
                IFNULL(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS totalRevenue,
                COUNT(id) AS totalAppointments,
                COUNT(CASE WHEN status = 'confirmed' THEN 1 END) AS confirmedAppointments,
                COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paidAppointments
            FROM appointments
            WHERE strftime('%Y-%m-%d', requestedTime) BETWEEN ? AND ?
        `;

    // Query สถิติในช่วงเวลาก่อนหน้า (Previous)
    const sqlPrevious = `
            SELECT
                IFNULL(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS totalRevenue,
                COUNT(id) AS totalAppointments
            FROM appointments
            WHERE strftime('%Y-%m-%d', requestedTime) BETWEEN ? AND ?
        `;

    // Query สถิติคงที่ (Static)
    const sqlStatic = `
            SELECT
                (SELECT COUNT(*) FROM users WHERE role = 'user') AS totalClients,
                (SELECT COUNT(*) FROM specialists) AS totalSpecialists
        `;

    // Query กราฟ (ยังใช้ CTE แต่เพิ่ม WHERE)
    const sqlChart = `
            WITH DailyStats AS (
                SELECT
                    strftime('%Y-%m-%d', requestedTime) AS date,
                    COUNT(id) AS appointmentCount,
                    IFNULL(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS dailyRevenue
                FROM appointments
                WHERE strftime('%Y-%m-%d', requestedTime) BETWEEN ? AND ?
                GROUP BY date
                ORDER BY date ASC
            )
            SELECT * FROM DailyStats;
        `;

    // 5. รันทุก Query พร้อมกันด้วย Promise.all
    const [currentStats, previousStats, staticStats, chartData] =
      await Promise.all([
        dbGet(sqlCurrent, [currentStartStr, currentEndStr]),
        dbGet(sqlPrevious, [prevStartStr, prevEndStr]),
        dbGet(sqlStatic),
        dbAll(sqlChart, [currentStartStr, currentEndStr]),
      ]);

    // 6. ส่งข้อมูลทั้งหมดกลับไป
    res.json({
      dateRange: {
        start: currentStartStr,
        end: currentEndStr,
      },
      previousDateRange: {
        start: prevStartStr,
        end: prevEndStr,
      },
      stats: {
        current: currentStats,
        previous: previousStats,
        static: staticStats,
      },
      chartData: chartData,
    });
  } catch (err) {
    console.error("Error fetching dashboard report:", err.message);
    res.status(500).json({ error: err.message });
  }
});
// --- 💡 (สำคัญ) Webhook ต้องอยู่ก่อน express.json() ---
// API นี้ Omise จะเรียกมา
app.post("/api/omise-webhook", express.json(), (req, res) => {
  const event = req.body;
  try {
    if (event.object === "event" && event.key === "charge.complete") {
      const charge = event.data;
      if (charge.status === "successful") {
        const appointmentId = charge.metadata.appointmentId;
        const chargeId = charge.id;

        console.log(
          `Webhook: Payment Succeeded for Appointment ID: ${appointmentId}`
        );
        // อัปเดต Database ของเราว่า "จ่ายแล้ว"
        const sql = `UPDATE appointments SET paymentStatus = 'paid' WHERE id = ? AND omiseChargeId = ?`;
        db.run(sql, [appointmentId, chargeId], (err) => {
          if (err) console.error("Webhook: Failed to update DB:", err);
          else
            console.log(
              `Webhook: Appointment ${appointmentId} marked as PAID.`
            );
        });
      }
    }
  } catch (err) {
    console.error("Webhook processing error:", err);
  }
  res.status(200).send("OK");
});

// --- สิ้นสุด Webhook ---

// ❌ (โค้ด const verifyToken และ const verifyAdmin เดิมถูกลบออกจากตรงนี้แล้ว) ❌

// 1. API สำหรับดึงสถิติรวม (ใช้ Subquery ตามที่คุณขอ)
// --------------------------------------------------
app.get("/api/dashboard/summary", verifyToken, verifyAdmin, (req, res) => {
  // ใช้ Subquery ในการ SELECT แต่ละค่า
  const sql = `
        SELECT
            (SELECT COUNT(*) FROM users WHERE role = 'user') AS totalClients,
            (SELECT COUNT(*) FROM specialists) AS totalSpecialists,
            (SELECT COUNT(*) FROM appointments WHERE status = 'confirmed') AS confirmedAppointments,
            (SELECT IFNULL(SUM(amount), 0) FROM appointments WHERE status = 'paid') AS totalRevenue
    `;

  db.get(sql, [], (err, row) => {
    if (err) {
      console.error("Error fetching summary:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json({ data: row });
  });
});

// 2. API สำหรับดึงข้อมูลกราฟ (ใช้ CTE ตามที่คุณขอ)
// --------------------------------------------------
app.get(
  "/api/dashboard/chart/daily-stats",
  verifyToken,
  verifyAdmin,
  (req, res) => {
    // ใช้ CTE (WITH Clause) เพื่อเตรียมข้อมูลรายวัน
    const sql = `
        WITH DailyStats AS (
            SELECT
                -- จัดกลุ่มข้อมูลตามวัน (รูปแบบ 'YYYY-MM-DD')
                strftime('%Y-%m-%d', requestedTime) AS date,
                
                -- นับจำนวนนัดหมายทั้งหมดในวันนั้น
                COUNT(id) AS appointmentCount,
                
                -- รวมรายได้เฉพาะนัดหมายที่ 'paid' ในวันนั้น
                IFNULL(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS dailyRevenue
            FROM 
                appointments
            GROUP BY 
                date
            ORDER BY 
                date ASC
            LIMIT 30 -- เอากราฟย้อนหลัง 30 วัน/รายการล่าสุด
        )
        SELECT * FROM DailyStats;
    `;

    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error("Error fetching chart data:", err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json({ data: rows });
    });
  }
);

app.use(express.json()); // 💡 express.json() ต้องอยู่หลัง Webhook
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let dest;
    if (file.fieldname === "mediaFile") {
      dest = path.join(__dirname, "public/uploads/media");
    } else if (file.fieldname === "thumbnailFile") {
      dest = path.join(__dirname, "public/uploads/thumbnails");
    }
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

// --- Cohere AI Setup ---
const cohere = new CohereClientV2({
  token: process.env.COHERE_API_KEY,
});

const systemPreamble = `
  คุณคือ "MindCare AI" ผู้ช่วย AI ที่มีความเห็นอกเห็นใจและให้การสนับสนุน... (เหมือนเดิม)
`;

// --- Middleware ---

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) return res.status(401).json({ error: "Missing token" });

  jwt.verify(
    token,
    process.env.JWT_SECRET || "your_default_secret_key",
    (err, user) => {
      if (err)
        return res.status(403).json({ error: "Invalid or expired token" });
      req.user = user;
      next();
    }
  );
}
const authenticateAdminOrDoctor = (req, res, next) => {
  // (ต้องใช้ *หลังจาก* authenticateToken)
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'doctor')) {
    return res.status(403).json({ error: "Forbidden: Access denied" });
  }
  next();
};

function isAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied. Admins only." });
  }
  next();
}

const isDoctor = (req, res, next) => {
  if (req.user && req.user.role === "doctor") {
    next();
  } else {
    res.status(403).json({ error: "Access forbidden: Doctor role required." });
  }
};

// --- API ROUTES ---

// 1. AI Chat Route
app.post("/api/chat", async (req, res) => {
  try {
    const userMessageText = req.body.message;
    if (!userMessageText) {
      return res.status(400).json({ error: "Message is required" });
    }
    const response = await cohere.chat({
      model: "command-a-03-2025",
      messages: [
        { role: "system", content: systemPreamble },
        { role: "user", content: userMessageText },
      ],
    });
    const aiReply = response.message.content[0].text;
    res.json({ reply: aiReply });
  } catch (error) {
    console.error("Error processing chat:", error);
    res.status(500).json({ error: "Failed to get response from AI" });
  }
});
// --- API ROUTES ---

// 1. AI Chat Route
app.post("/api/chat", async (req, res) => {
  try {
    const userMessageText = req.body.message;
    if (!userMessageText) {
      return res.status(400).json({ error: "Message is required" });
    }
    const response = await cohere.chat({
      model: "command-a-03-2025",
      messages: [
        { role: "system", content: systemPreamble },
        { role: "user", content: userMessageText },
      ],
    });
    const aiReply = response.message.content[0].text;
    res.json({ reply: aiReply });
  } catch (error) {
    console.error("Error processing chat:", error);
    res.status(500).json({ error: "Failed to get response from AI" });
  }
});

// 2. Auth Routes
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required." });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = "INSERT INTO users (username, password) VALUES (?, ?)";
    db.run(sql, [username, hashedPassword], function (err) {
      if (err) {
        if (err.message.includes("UNIQUE constraint failed")) {
          return res.status(409).json({ error: "Username already exists." });
        }
        return res
          .status(500)
          .json({ error: "Database error during registration." });
      }
      res
        .status(201)
        .json({ message: "User created successfully.", userId: this.lastID });
    });
  } catch (error) {
    res.status(500).json({ error: "Server error during registration." });
  }
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required." });
  }
  const sql = "SELECT * FROM users WHERE username = ?";
  db.get(sql, [username], async (err, user) => {
    if (err)
      return res.status(500).json({ error: "Database error during login." });
    if (!user) return res.status(401).json({ error: "Invalid credentials." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ error: "Invalid credentials." });

    const tokenPayload = {
      id: user.id,
      username: user.username,
      role: user.role,
    };
    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || "your_default_secret_key",
      { expiresIn: "1h" }
    );
    res.json({ message: "Login successful.", token: token });
  });
});

// 3. User Management Routes (Admin)
app.get("/api/users", authenticateToken, isAdmin, (req, res) => {
  const sql = "SELECT id, username, role FROM users";
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "success", data: rows });
  });
});

// 💡 (แก้ไข) นี่คือเวอร์ชันที่ถูกต้อง (ไม่มี Logic สร้าง specialist อัตโนมัติ)
app.put("/api/users/:id/role", authenticateToken, isAdmin, (req, res) => {
  const { role } = req.body;
  const userId = req.params.id;

  if (!["user", "admin", "doctor"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  const updateRoleSql = `UPDATE users SET role = ? WHERE id = ?`;

  db.run(updateRoleSql, [role, userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0)
      return res.status(404).json({ error: "User not found" });

    res.json({ message: "User role updated." });
  });
});

app.delete("/api/users/:id", authenticateToken, isAdmin, (req, res) => {
  const userId = req.params.id;
  const sql = "DELETE FROM users WHERE id = ?";
  db.run(sql, [userId], function (err) {
    if (err) return res.status(500).json({ error: "Failed to delete user." });
    if (this.changes === 0)
      return res.status(404).json({ error: "User not found." });
    res.json({ message: "User deleted successfully." });
  });
});

// 4. Podcast Routes (Admin + Public)
app.get("/api/podcasts", (req, res) => {
  const sql = "SELECT * FROM podcasts ORDER BY id DESC";
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

app.get("/api/podcasts/:id", (req, res) => {
  const sql = "SELECT * FROM podcasts WHERE id = ?";
  db.get(sql, [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Podcast not found." });
    res.json({ data: row });
  });
});

app.post(
  "/api/podcasts",
  authenticateToken,
  isAdmin,
  upload.fields([
    { name: "mediaFile", maxCount: 1 },
    { name: "thumbnailFile", maxCount: 1 },
  ]),
  async (req, res) => {
    const {
      title,
      description,
      type,
      youtubeUrl,
      thumbnailUrl: thumbUrlText,
    } = req.body;
    let finalUrl = "",
      finalThumbnailUrl = "";

    if (type === "youtube") {
      finalUrl = youtubeUrl;
      finalThumbnailUrl = thumbUrlText;
    } else if (type === "upload") {
      if (req.files.mediaFile)
        finalUrl = `http://localhost:3001/uploads/media/${req.files.mediaFile[0].filename}`;
      if (req.files.thumbnailFile)
        finalThumbnailUrl = `http://localhost:3001/uploads/thumbnails/${req.files.thumbnailFile[0].filename}`;
    } else {
      return res.status(400).json({ error: "Invalid podcast type." });
    }

    const sql = `INSERT INTO podcasts (title, description, type, url, thumbnailUrl) VALUES (?, ?, ?, ?, ?)`;
    const params = [title, description, type, finalUrl, finalThumbnailUrl];

    db.run(sql, params, function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res
        .status(201)
        .json({
          data: {
            id: this.lastID,
            ...req.body,
            url: finalUrl,
            thumbnailUrl: finalThumbnailUrl,
          },
        });
    });
  }
);

app.delete(
  "/api/podcasts/:id",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    const id = req.params.id;
    try {
      // 1. ดึงข้อมูลเก่าก่อน
      const row = await dbGet(
        "SELECT type, url, thumbnailUrl FROM podcasts WHERE id = ?",
        [id]
      );
      if (!row) return res.status(404).json({ error: "Podcast not found." });

      // 2. ถ้าเป็น 'upload' ให้ลบไฟล์
      if (row.type === "upload") {
        deleteFileByUrl(row.url);
        deleteFileByUrl(row.thumbnailUrl);
      }

      // 3. ลบข้อมูลใน DB
      db.run("DELETE FROM podcasts WHERE id = ?", [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0)
          return res.status(404).json({ error: "Podcast not found." });
        res.json({ message: "Podcast deleted successfully." });
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);
app.put(
  "/api/podcasts/:id",
  authenticateToken,
  isAdmin,
  upload.fields([
    { name: "mediaFile", maxCount: 1 },
    { name: "thumbnailFile", maxCount: 1 },
  ]),
  async (req, res) => {
    const { id } = req.params;
    const {
      title,
      description,
      type,
      youtubeUrl,
      thumbnailUrl: thumbUrlText,
    } = req.body;

    try {
      // 1. ดึงข้อมูล podcast เก่า
      const oldPodcast = await dbGet("SELECT * FROM podcasts WHERE id = ?", [
        id,
      ]);
      if (!oldPodcast)
        return res.status(404).json({ error: "Podcast not found." });

      // 2. ตั้งค่า URL เริ่มต้นเป็นค่าเก่า
      let newUrl = oldPodcast.url;
      let newThumb = oldPodcast.thumbnailUrl;

      if (type === "youtube") {
        newUrl = youtubeUrl;
        newThumb = thumbUrlText;

        // 3. ถ้าของเก่าเคยเป็น upload ให้ลบไฟล์เก่าทิ้ง
        if (oldPodcast.type === "upload") {
          deleteFileByUrl(oldPodcast.url);
          deleteFileByUrl(oldPodcast.thumbnailUrl);
        }
      } else if (type === "upload") {
        // 4. ถ้ามีไฟล์ media ใหม่มา ให้ลบของเก่า (ถ้ามี) แล้วอัปเดต
        if (req.files.mediaFile) {
          deleteFileByUrl(oldPodcast.url); // ลบไฟล์เก่า
          newUrl = `http://localhost:3001/uploads/media/${req.files.mediaFile[0].filename}`;
        }
        // 5. ถ้ามีไฟล์ปกใหม่มา ให้ลบของเก่า (ถ้ามี) แล้วอัปเดต
        if (req.files.thumbnailFile) {
          deleteFileByUrl(oldPodcast.thumbnailUrl); // ลบปกเก่า
          newThumb = `http://localhost:3001/uploads/thumbnails/${req.files.thumbnailFile[0].filename}`;
        }
      }

      // 6. อัปเดตข้อมูลลง Database
      const sql = `UPDATE podcasts SET 
                        title = ?, description = ?, type = ?, 
                        url = ?, thumbnailUrl = ? 
                     WHERE id = ?`;

      db.run(
        sql,
        [title, description, type, newUrl, newThumb, id],
        async function (err) {
          if (err) return res.status(500).json({ error: err.message });

          // 7. ดึงข้อมูลที่อัปเดตแล้วส่งกลับไป
          const updatedPodcast = await dbGet(
            "SELECT * FROM podcasts WHERE id = ?",
            [id]
          );
          res.json({ message: "Podcast updated.", data: updatedPodcast });
        }
      );
    } catch (err) {
      console.error("Error updating podcast:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// 5. Specialist Routes (Admin + Public)

// 💡 (แก้ไข) อัปเกรดให้ JOIN User เพื่อใช้ใน Admin Panel
app.get("/api/specialists", (req, res) => {
  const sql = `
        SELECT s.*, u.username AS linkedUsername 
        FROM specialists s
        LEFT JOIN users u ON s.userId = u.id
        ORDER BY s.name
    `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

app.get(
  "/api/users/doctors-available",
  authenticateToken,
  isAdmin,
  (req, res) => {
    const sql = `
        SELECT u.id, u.username 
        FROM users u
        LEFT JOIN specialists s ON u.id = s.userId
        WHERE u.role = 'doctor' AND s.id IS NULL
    `;
    db.all(sql, [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ data: rows });
    });
  }
);

app.post("/api/specialists", authenticateToken, isAdmin, (req, res) => {
  const { name, title, specialty, description, photoUrl, userId } = req.body;
  if (!name || !title) {
    return res.status(400).json({ error: "Name and title are required." });
  }
  const finalUserId = userId === "" || userId === undefined ? null : userId;
  const sql = `INSERT INTO specialists (name, title, specialty, description, photoUrl, userId) 
                 VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(
    sql,
    [name, title, specialty, description, photoUrl, finalUserId],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE constraint failed")) {
          return res
            .status(409)
            .json({ error: "User นี้ถูกเชื่อมโยงกับโปรไฟล์อื่นแล้ว" });
        }
        return res.status(500).json({ error: err.message });
      }
      const newSpecId = this.lastID;
      db.get(
        `SELECT s.*, u.username AS linkedUsername 
                FROM specialists s 
                LEFT JOIN users u ON s.userId = u.id 
                WHERE s.id = ?`,
        [newSpecId],
        (err, row) => {
          if (err) return res.status(500).json({ error: err.message });
          res.status(201).json({ message: "Specialist created.", data: row });
        }
      );
    }
  );
});

app.put("/api/specialists/:id", authenticateToken, isAdmin, (req, res) => {
  const { id } = req.params;
  const { name, title, specialty, description, photoUrl, userId } = req.body;
  if (!name || !title) {
    return res.status(400).json({ error: "Name and title are required." });
  }
  const finalUserId = userId === "" || userId === undefined ? null : userId;
  const sql = `UPDATE specialists SET 
                    name = ?, title = ?, specialty = ?, 
                    description = ?, photoUrl = ?, userId = ?
                 WHERE id = ?`;
  db.run(
    sql,
    [name, title, specialty, description, photoUrl, finalUserId, id],
    function (err) {
      if (err) {
        if (err.message.includes("UNIQUE constraint failed")) {
          return res
            .status(409)
            .json({ error: "User นี้ถูกเชื่อมโยงกับโปรไฟล์อื่นแล้ว" });
        }
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0)
        return res.status(404).json({ error: "Specialist not found" });

      db.get(
        `SELECT s.*, u.username AS linkedUsername 
                FROM specialists s 
                LEFT JOIN users u ON s.userId = u.id 
                WHERE s.id = ?`,
        [id],
        (err, row) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: "Specialist updated.", data: row });
        }
      );
    }
  );
});

app.delete("/api/specialists/:id", authenticateToken, isAdmin, (req, res) => {
  const { id } = req.params;
  const sql = `DELETE FROM specialists WHERE id = ?`;
  db.run(sql, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0)
      return res.status(404).json({ error: "Specialist not found" });
    res.json({ message: "Specialist profile deleted." });
  });
});

// 6. Appointment Routes (User, Admin, Doctor)

// 💡 (แก้ไข) นี่คือเวอร์ชันที่ถูกต้อง (จัดลำดับ Callback ใหม่)
app.post("/api/appointments", authenticateToken, (req, res) => {
  const { specialistId, reason, requestedTime } = req.body;
  const userId = req.user.id;

  if (!specialistId || !requestedTime) {
    return res.status(400).json({ error: "Specialist and time are required." });
  }

  // 1. ค้นหาราคาของหมอก่อน
  db.get(
    `SELECT price FROM specialists WHERE id = ?`,
    [specialistId],
    (err, specialist) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!specialist)
        return res.status(404).json({ error: "Specialist not found." });

      const amount = specialist.price; // ได้ราคามาแล้ว

      // 2. บันทึกนัดหมาย (พร้อมราคา)
      const sql = `INSERT INTO appointments (userId, specialistId, reason, requestedTime, amount) 
                     VALUES (?, ?, ?, ?, ?)`;

      // 3. ทั้งหมดต้องอยู่ใน callback ของ db.run
      db.run(
        sql,
        [userId, specialistId, reason, requestedTime, amount],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });

          const newAppointmentId = this.lastID; // ID ของคิวที่เพิ่งจอง

          // 4. ดึงข้อมูลนัดหมายใหม่ (พร้อมชื่อหมอ) เพื่อส่งกลับไป
          const newApptSql = `
                SELECT a.*, s.name AS specialistName 
                FROM appointments a
                JOIN specialists s ON a.specialistId = s.id
                WHERE a.id = ?
            `;

          db.get(newApptSql, [newAppointmentId], (err, newApptRow) => {
            if (err) {
              return res
                .status(500)
                .json({
                  error: "Booking created, but failed to fetch new row.",
                });
            }

            // 5. (ส่วนของการแจ้งเตือนหมอ)
            try {
              db.get(
                `SELECT userId FROM specialists WHERE id = ?`,
                [specialistId],
                (err, spec) => {
                  if (spec && spec.userId) {
                    db.run(
                      `INSERT INTO notifications (userId, message, linkTo) VALUES (?, ?, ?)`,
                      [
                        spec.userId,
                        `คุณมีคำขอนัดหมายใหม่ (ID: ${newAppointmentId})`,
                        `/doctor/dashboard`,
                      ]
                    );
                  }
                }
              );
            } catch (notifyError) {
              console.error("Failed to create notification:", notifyError);
            }

            // 6. ส่งข้อมูลคิวใหม่กลับไปให้ React
            res
              .status(201)
              .json({
                message: "Booking request submitted.",
                data: newApptRow,
              });
          });
        }
      ); // สิ้นสุด callback ของ db.run
    }
  ); // สิ้นสุด callback ของ db.get
});

// 💡 (แก้ไข) นี่คือเวอร์ชันที่ถูกต้อง (SELECT a.*)
app.get("/api/my-appointments", authenticateToken, (req, res) => {
  const userId = req.user.id;

  // 💡 ต้อง SELECT a.* เพื่อให้ได้ a.paymentStatus มาด้วย
  const sql = `
        SELECT 
            a.*, 
            s.name AS specialistName, 
            s.title AS specialistTitle
        FROM appointments a
        JOIN specialists s ON a.specialistId = s.id
        WHERE a.userId = ?
        ORDER BY a.createdAt DESC
    `;
  db.all(sql, [userId], (err, rows) => {
    if (err) {
      console.error("Error fetching my-appointments:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json({ data: rows });
  });
});

app.get("/api/appointments/all", authenticateToken, isAdmin, (req, res) => {
  const sql = `
        SELECT 
            a.id, a.reason, a.requestedTime, a.status, a.createdAt,
            u.username AS userName,
            s.name AS specialistName
        FROM appointments a
        JOIN users u ON a.userId = u.id
        JOIN specialists s ON a.specialistId = s.id
        ORDER BY a.createdAt DESC
    `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

app.put(
  "/api/appointments/:id/status",
  authenticateToken,
  isAdmin,
  (req, res) => {
    const { status } = req.body;
    const appointmentId = req.params.id;

    if (!["pending", "confirmed", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value." });
    }
    const updateSql = `UPDATE appointments SET status = ? WHERE id = ?`;

    db.run(updateSql, [status, appointmentId], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0)
        return res.status(404).json({ error: "Appointment not found" });

      if (status === "confirmed") {
        try {
          db.get(
            `SELECT specialistId FROM appointments WHERE id = ?`,
            [appointmentId],
            (err, appt) => {
              if (err || !appt) return;
              db.get(
                `SELECT userId FROM specialists WHERE id = ?`,
                [appt.specialistId],
                (err, spec) => {
                  if (err || !spec || !spec.userId) return;
                  const doctorUserId = spec.userId;
                  const message = `คุณมีนัดหมาย (ID: ${appointmentId}) ที่ได้รับการยืนยันจากแอดมินแล้ว`;
                  db.run(
                    `INSERT INTO notifications (userId, message, linkTo) VALUES (?, ?, ?)`,
                    [doctorUserId, message, `/doctor/dashboard`]
                  );
                }
              );
            }
          );
        } catch (notifyError) {
          console.error("Error queueing notification:", notifyError);
        }
      }
      res.json({ message: "Appointment status updated." });
    });
  }
);

app.get(
  "/api/appointments/my-doctor",
  authenticateToken,
  isDoctor,
  (req, res) => {
    const doctorUserId = req.user.id;
    db.get(
      `SELECT id FROM specialists WHERE userId = ?`,
      [doctorUserId],
      (err, specialist) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!specialist) {
          return res
            .status(404)
            .json({ error: "ไม่พบโปรไฟล์ผู้เชี่ยวชาญที่เชื่อมกับบัญชีนี้" });
        }
        const specialistId = specialist.id;
        const sql = `
            SELECT a.*, u.username AS userName
            FROM appointments a
            JOIN users u ON a.userId = u.id
            WHERE a.specialistId = ?
            ORDER BY a.createdAt DESC
        `;
        db.all(sql, [specialistId], (err, rows) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ data: rows });
        });
      }
    );
  }
);

app.put(
  "/api/appointments/:id/status-doctor",
  authenticateToken,
  isDoctor,
  (req, res) => {
    const doctorUserId = req.user.id;
    const appointmentId = req.params.id;
    const { status } = req.body;

    if (!["pending", "confirmed", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value." });
    }
    db.get(
      `SELECT id FROM specialists WHERE userId = ?`,
      [doctorUserId],
      (err, specialist) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!specialist)
          return res
            .status(403)
            .json({ error: "Forbidden: No specialist profile." });

        const specialistId = specialist.id;
        db.get(
          `SELECT specialistId FROM appointments WHERE id = ?`,
          [appointmentId],
          (err, appt) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!appt)
              return res.status(404).json({ error: "Appointment not found." });
            if (appt.specialistId !== specialistId) {
              return res
                .status(403)
                .json({
                  error: "Forbidden: You cannot update this appointment.",
                });
            }
            const updateSql = `UPDATE appointments SET status = ? WHERE id = ?`;
            db.run(updateSql, [status, appointmentId], function (err) {
              if (err) return res.status(500).json({ error: err.message });
              if (this.changes === 0)
                return res
                  .status(404)
                  .json({ error: "Appointment update failed." });
              res.json({ message: "Appointment status updated by doctor." });
            });
          }
        );
      }
    );
  }
);

// 7. Notification Routes (Doctor/User)
// 💡 (เพิ่ม) API ที่หายไป
app.get("/api/notifications/my", authenticateToken, (req, res) => {
  const userId = req.user.id;
  const sql = `
        SELECT * FROM notifications 
        WHERE userId = ? AND isRead = 0 
        ORDER BY createdAt DESC
    `;
  db.all(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: rows });
  });
});

app.post("/api/notifications/:id/read", authenticateToken, (req, res) => {
  const notifyId = req.params.id;
  const userId = req.user.id;
  const sql = `UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?`;
  db.run(sql, [notifyId, userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Notification marked as read." });
  });
});

// 8. Payment Routes (Omise)
// 💡 (เพิ่ม) API ที่หายไป
app.post(
  "/api/appointments/:id/pay-with-omise",
  authenticateToken,
  async (req, res) => {
    const { id: appointmentId } = req.params;
    const { omiseToken } = req.body;
    const userId = req.user.id;

    if (!omiseToken) {
      return res.status(400).json({ error: "Omise token is required." });
    }

    try {
      const sql = `SELECT * FROM appointments WHERE id = ? AND userId = ?`;
      db.get(sql, [appointmentId, userId], async (err, appt) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!appt)
          return res
            .status(404)
            .json({ error: "Appointment not found or not yours." });
        if (appt.status !== "confirmed")
          return res
            .status(400)
            .json({ error: "นัดหมายนี้ยังไม่ได้รับการยืนยัน" });
        if (appt.paymentStatus === "paid")
          return res.status(400).json({ error: "นัดหมายนี้ชำระเงินแล้ว" });

        const amountInSatang = appt.amount * 100; // Omise ใช้หน่วยสตางค์

        const charge = await omise.charges.create({
          amount: amountInSatang,
          currency: "thb",
          card: omiseToken,
          metadata: {
            appointmentId: appt.id,
            userId: appt.userId,
          },
          return_uri: `http://localhost:5173/consult`, // 💡 เปลี่ยนเป็น URL หน้าเว็บของคุณ
        });

        db.run(`UPDATE appointments SET omiseChargeId = ? WHERE id = ?`, [
          charge.id,
          appt.id,
        ]);

        if (charge.status === "successful") {
          db.run(
            `UPDATE appointments SET paymentStatus = 'paid' WHERE id = ?`,
            [appt.id]
          );
          res.json({ status: "successful", message: "ชำระเงินสำเร็จ" });
        } else if (charge.authorize_uri) {
          // ต้องทำ 3D Secure
          res.json({ status: "pending", authorize_uri: charge.authorize_uri });
        } else {
          res
            .status(400)
            .json({ error: charge.failure_message || "การชำระเงินล้มเหลว" });
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  }
);
app.get("/api/external-podcasts", async (req, res) => {
  
  // 1. 💡 รับค่า page และ limit จาก query string (ถ้าไม่ส่งมา ให้ใช้ค่าเริ่มต้น)
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20; // 💡 20 รายการต่อหน้า
  const offset = (page - 1) * limit; // 💡 คำนวณ offset สำหรับ API

  console.log(`GET /api/external-podcasts - Page: ${page}, Limit: ${limit}, Offset: ${offset}`);
  
  try {
    const ITUNES_API_URL = "https://itunes.apple.com/search";
    
    const response = await axios.get(ITUNES_API_URL, {
      params: {
        term: "health",
        country: "TH",
        media: "podcast",
        limit: limit,   // 💡 ส่ง limit ที่ได้รับ
        offset: offset  // 💡 ส่ง offset ที่คำนวณได้
      }
    });

    // (ส่วน map ข้อมูลเหมือนเดิม)
    const externalPodcasts = response.data.results
      .filter(podcast => podcast.trackId && podcast.collectionName && podcast.trackViewUrl)
      .map(podcast => {
        return {
          id: `ext-${podcast.trackId}`,
          title: podcast.collectionName,
          description: `โดย: ${podcast.artistName || 'ไม่ระบุผู้จัด'}`, 
          type: "external",
          url: podcast.trackViewUrl,
          thumbnailUrl: podcast.artworkUrl600 || podcast.artworkUrl100 || 'https://via.placeholder.com/600x600.png?text=Podcast'
        };
      });
    
    // 2. 💡 ตรวจสอบว่ามีข้อมูลหน้าถัดไปหรือไม่
    // (ถ้าข้อมูลที่ได้กลับมา = limit พอดี, แปลว่า *อาจจะ* มีหน้าต่อไป)
    const hasMore = externalPodcasts.length === limit; 

    console.log(`Fetched ${externalPodcasts.length} external. HasMore: ${hasMore}`);

    // 3. 💡 ส่งข้อมูลกลับไปพร้อมกับธง 'hasMore'
    res.json({
      status: "success",
      data: externalPodcasts,
      hasMore: hasMore // 💡 ส่งค่านี้กลับไปให้ Frontend
    });

  } catch (error) {
    console.error("Error fetching from iTunes API:", error.message);
    res.status(500).json({ status: "error", error: "Failed to fetch external podcasts" });
  }
});
const authorizeChatAccess = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user.id; // มาจาก authenticateToken

    const sql = `
      SELECT
        a.userId AS patientUserId,
        s.userId AS doctorUserId
      FROM appointments a
      JOIN specialists s ON a.specialistId = s.id
      WHERE a.id = ?
    `;
    const apptUsers = await dbGet(sql, [appointmentId]); // dbGet อยู่ใน server.js ของคุณแล้ว

    if (!apptUsers) {
      return res.status(404).json({ error: "ไม่พบการนัดหมายนี้" });
    }

    // 💡 ตรวจสอบว่า userId ที่ล็อกอินเข้ามา เป็นหมอ หรือ คนไข้ ในนัดหมายนี้หรือไม่
    if (userId !== apptUsers.patientUserId && userId !== apptUsers.doctorUserId) {
      return res.status(403).json({ error: "คุณไม่มีสิทธิ์เข้าถึงแชทนี้" }); // 403 Forbidden
    }
    
    // 💡 ส่งข้อมูลผู้ใช้ทั้งสองไปให้ Endpoint ถัดไป
    req.apptUsers = apptUsers; 
    next(); // อนุญาตให้ผ่าน

  } catch (error) {
    console.error("Chat Auth Error:", error.message);
    res.status(500).json({ error: "Server Error" });
  }
};


// 2. GET Endpoint: ดึงข้อความทั้งหมดในแชท
app.get("/api/chat/:appointmentId", authenticateToken, authorizeChatAccess, async (req, res) => {
  try {
    const { appointmentId } = req.params;

    // 💡 ดึงข้อมูลหมอ/คนไข้ เพิ่มเติมเพื่อแสดงชื่อในแชท
    const { patientUserId, doctorUserId } = req.apptUsers;
    const patient = await dbGet(`SELECT id, username FROM users WHERE id = ?`, [patientUserId]);
    const doctor = await dbGet(`SELECT id, username FROM users WHERE id = ?`, [doctorUserId]);

    // ดึงข้อความทั้งหมด
    const messages = await dbAll(
      `SELECT * FROM chat_messages WHERE appointmentId = ? ORDER BY timestamp ASC`,
      [appointmentId]
    );

    res.json({
      status: "success",
      data: {
        messages: messages,
        patient: patient,
        doctor: doctor
      }
    });

  } catch (error) {
    console.error("GET Chat Error:", error.message);
    res.status(500).json({ error: "ไม่สามารถดึงข้อมูลแชทได้" });
  }
});


// 3. POST Endpoint: ส่งข้อความใหม่
app.post("/api/chat/:appointmentId", authenticateToken, authorizeChatAccess, async (req, res) => {
  
  // 💡 1. ใช้ try...catch บล็อกเดียว
  try {
    const { appointmentId } = req.params;
    const { message } = req.body;
    const senderId = req.user.id; // ID ของคนส่ง (ที่ล็อกอินอยู่)

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: "ข้อความห้ามว่างเปล่า" });
    }

    // 2. หาผู้รับ (Receiver)
    const { patientUserId, doctorUserId } = req.apptUsers;
    const receiverId = (senderId === patientUserId) ? doctorUserId : patientUserId;

    const sql = `
      INSERT INTO chat_messages (appointmentId, senderId, receiverId, message, timestamp)
      VALUES (?, ?, ?, ?, datetime('now'))
    `;
    
    // 💡 3. ใช้ await dbRun (นี่คือส่วนที่แก้ไข)
    // (เราไม่ต้องใช้ callback อีกต่อไป)
    const result = await dbRun(sql, [appointmentId, senderId, receiverId, message]);
    
    // 💡 4. ดึง ID ของข้อความที่เพิ่งสร้าง
    const newMessageId = result.lastID;

    // 💡 5. ดึงข้อความเต็มๆ กลับมาด้วย await dbGet (นี่คือส่วนที่แก้ไข)
    const newRow = await dbGet(`SELECT * FROM chat_messages WHERE id = ?`, [newMessageId]);

    // 💡 6. ส่งข้อความใหม่ (newRow) กลับไปให้ Frontend ทันที
    // (Frontend จะได้รับข้อมูลนี้ใน res.data.data)
    res.status(201).json({ status: "success", data: newRow });

  } catch (error) {
    // 💡 7. try...catch นี้จะดักจับ Error จาก dbRun หรือ dbGet ได้อย่างถูกต้อง
    console.error("POST Chat Error:", error.message);
    res.status(500).json({ error: "ไม่สามารถส่งข้อความได้" });
  }
});

app.get("/api/appointments/my", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // 1. เอา ID ของคนที่ล็อกอินอยู่ (จาก authenticateToken)

    // 2. Query ตาราง appointments โดย JOIN กับ specialists
    //    เพื่อเอาชื่อหมอ (specialistName) มาด้วย (เหมือนใน ConsultPage.jsx)
    const sql = `
      SELECT 
        a.*, 
        s.name AS specialistName 
      FROM appointments a
      JOIN specialists s ON a.specialistId = s.id
      WHERE a.userId = ?
      ORDER BY a.requestedTime DESC
    `;
    
    // 3. ใช้ dbAll (ที่มีอยู่ใน server.js ของคุณแล้ว)
    const myAppointments = await dbAll(sql, [userId]);

    res.json({ status: "success", data: myAppointments });

  } catch (error) {
    console.error("Error fetching my appointments:", error.message);
    res.status(500).json({ error: "ไม่สามารถดึงข้อมูลการนัดหมายได้" });
  }
});
// --- 💡 API สำหรับแบบประเมินตนเอง 💡 ---

// 1. API: ดึงรายการแบบประเมินทั้งหมด (เช่น PHQ-9, GAD-7)
app.get("/api/assessments", authenticateToken, async (req, res) => {
  try {
    const assessments = await dbAll(`SELECT * FROM assessments`);
    res.json({ status: "success", data: assessments });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// 2. API: ดึงคำถามทั้งหมดของแบบประเมิน 1 ชุด
app.get("/api/assessment/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const assessment = await dbGet(`SELECT * FROM assessments WHERE id = ?`, [id]);
    if (!assessment) return res.status(404).json({ error: "ไม่พบแบบประเมิน" });

    const questions = await dbAll(
      `SELECT * FROM assessment_questions WHERE assessment_id = ? ORDER BY question_order ASC`,
      [id]
    );

    // แปลง JSON string กลับเป็น Object
    const parsedQuestions = questions.map(q => ({
      ...q,
      options: JSON.parse(q.options_json) 
    }));

    res.json({ status: "success", data: { assessment, questions: parsedQuestions } });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// 3. API: รับคำตอบ, คำนวณคะแนน, และบันทึกผล
app.post("/api/assessment/submit", authenticateToken, async (req, res) => {
  try {
    const { assessment_id, answers } = req.body; // 'answers' คือ array ของคะแนน [0, 1, 3, 2, ...]
    const user_id = req.user.id;

    // --- คำนวณคะแนน PHQ-9 ---
    // (ในอนาคต ถ้ามีหลายแบบทดสอบ เราต้องเช็ก assessment_id ก่อน)
    const score = answers.reduce((sum, score) => sum + score, 0);

    let interpretation = "";
    if (score >= 20) interpretation = "ซึมเศร้าระดับรุนแรงมาก";
    else if (score >= 15) interpretation = "ซึมเศร้าระดับรุนแรง";
    else if (score >= 10) interpretation = "ซึมเศร้าระดับปานกลาง";
    else if (score >= 5) interpretation = "ซึมเศร้าระดับน้อย";
    else interpretation = "มีภาวะซึมเศร้าน้อยมาก หรือไม่มี";

    // บันทึกลง DB
    const result = await dbRun(
      `INSERT INTO assessment_results (user_id, assessment_id, score, interpretation) VALUES (?, ?, ?, ?)`,
      [user_id, assessment_id, score, interpretation]
    );

    // ส่ง ID ของผลลัพธ์ใหม่กลับไป
    res.status(201).json({ status: "success", newResultId: result.lastID });

  } catch (error) {
    console.error("Submit Assessment Error:", error.message);
    res.status(500).json({ error: "ไม่สามารถบันทึกผลได้" });
  }
});

// 4. API: ดึงผลลัพธ์ (เพื่อโชว์หน้า "ผลการประเมิน")
app.get("/api/assessment/result/:resultId", authenticateToken, async (req, res) => {
  try {
    const { resultId } = req.params;
    const user_id = req.user.id;

    const result = await dbGet(
      `SELECT r.*, a.name as assessmentName 
       FROM assessment_results r
       JOIN assessments a ON r.assessment_id = a.id
       WHERE r.id = ? AND r.user_id = ?`, // 💡 ตรวจสอบว่าเป็นเจ้าของผลลัพธ์จริง
      [resultId, user_id]
    );

    if (!result) {
      return res.status(404).json({ error: "ไม่พบผลการประเมิน" });
    }
    res.json({ status: "success", data: result });

  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});
app.get("/api/journal", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const entries = await dbAll(
      `SELECT * FROM journal_entries WHERE user_id = ? ORDER BY entry_date DESC`,
      [userId]
    );
    res.json({ status: "success", data: entries });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// 2. GET: ดึงไดอารี่ของ "วันที่" ที่ระบุ (สำหรับกรอกฟอร์ม)
app.get("/api/journal/date/:date", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { date } = req.params; // 'YYYY-MM-DD'
    const entry = await dbGet(
      `SELECT * FROM journal_entries WHERE user_id = ? AND entry_date = ?`,
      [userId, date]
    );
    
    if (entry) {
      res.json({ status: "success", data: entry });
    } else {
      res.status(404).json({ status: "not_found", data: null });
    }
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// 3. POST: สร้าง หรือ อัปเดต ไดอารี่ (UPSERT)
// (ใช้ "ON CONFLICT" ที่เราตั้งค่า UNIQUE(user_id, entry_date) ไว้)
app.post("/api/journal", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { entry_date, mood_rating, entry_text } = req.body;

    if (!entry_date || !mood_rating) {
      return res.status(400).json({ error: "Date and mood are required" });
    }

    const sql = `
      INSERT INTO journal_entries (user_id, entry_date, mood_rating, entry_text)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, entry_date) DO UPDATE SET
        mood_rating = excluded.mood_rating,
        entry_text = excluded.entry_text,
        timestamp = datetime('now')
    `;
    
    await dbRun(sql, [userId, entry_date, mood_rating, entry_text]);
    
    // ดึงข้อมูลที่เพิ่งอัปเดต/สร้าง กลับไป
    const updatedEntry = await dbGet(
      `SELECT * FROM journal_entries WHERE user_id = ? AND entry_date = ?`,
      [userId, entry_date]
    );
    
    res.status(201).json({ status: "success", data: updatedEntry });
  } catch (error) {
    console.error("Journal POST error:", error.message);
    res.status(500).json({ error: "Could not save journal entry" });
  }
});
// 💡 5. GET: ดึง "สรุป" ไดอารี่ทั้งหมด (รายเดือน/ปี)
app.get("/api/journal/summary", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 💡 นี่คือ SQL ที่ใช้ Subquery ตามที่คุณต้องการ
    // 1. Subquery (ด้านใน): ดึงข้อมูล 'year', 'month', 'mood_rating'
    // 2. Query (ด้านนอก): ทำการ GROUP BY และ AVG (หาค่าเฉลี่ย)
    const sql = `
      SELECT
        t.year,
        t.month,
        AVG(t.mood_rating) AS avg_mood,
        COUNT(t.id) AS entry_count
      FROM (
        -- === Subquery เริ่ม ===
        SELECT
          id,
          mood_rating,
          strftime('%Y', entry_date) AS year,
          strftime('%m', entry_date) AS month
        FROM journal_entries
        WHERE user_id = ?
        -- === Subquery จบ ===
      ) AS t
      GROUP BY t.year, t.month
      ORDER BY t.year DESC, t.month DESC;
    `;
    
    const summaryData = await dbAll(sql, [userId]);
    
    res.json({ status: "success", data: summaryData });
  } catch (error)
 {
    console.error("Journal Summary GET error:", error.message);
    res.status(500).json({ error: "Could not get journal summary" });
  }
});
// 4. DELETE: ลบไดอารี่
app.delete("/api/journal/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    // 💡 ต้องเช็ก user_id ด้วย เพื่อความปลอดภัย (ห้ามลบของคนอื่น)
    const result = await dbRun(
      `DELETE FROM journal_entries WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: "ไม่พบไดอารี่ หรือไม่มีสิทธิ์ลบ" });
    }
    
    res.json({ status: "success", message: "ลบไดอารี่แล้ว" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});
app.get("/api/stream", async (req, res) => {
  try {
    // ดึงแถวเดียวที่มีอยู่ (id = 1)
    const streamSettings = await dbGet("SELECT is_live, stream_url, stream_title FROM stream_settings WHERE id = 1");
    
    if (!streamSettings) {
       // กรณีตารางว่าง (ไม่ควรเกิดถ้า seed ทำงาน)
       return res.json({ is_live: 0, stream_title: "Stream Offline", stream_url: null });
    }
    res.json(streamSettings);
  } catch (error) {
    console.error("GET /api/stream error:", error.message);
    res.status(500).json({ error: "Could not fetch stream status" });
  }
});

// PUT: (Protected) อัปเดตสถานะ Stream (เฉพาะ Admin/Doctor)
app.put("/api/stream", authenticateToken, authenticateAdminOrDoctor, async (req, res) => {
  // 💡 1. เราต้องการแค่ is_live (boolean) และ stream_title (string)
  const { is_live, stream_title } = req.body;

  // Validation
  if (typeof is_live !== 'boolean' || !stream_title) {
    return res.status(400).json({ error: "Invalid data. 'is_live' (boolean) and 'stream_title' (string) are required." });
  }

  try {
    const sql = `
      UPDATE stream_settings 
      SET 
        is_live = ?, 
        stream_title = ?,
        stream_url = NULL, -- 💡 2. เราไม่ใช้ URL แล้ว ให้เป็น NULL ไป
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `;
    
    const liveStatus = is_live ? 1 : 0; // แปลง boolean เป็น 0/1

    await dbRun(sql, [liveStatus, stream_title]);
    
    // ส่งข้อมูลที่อัปเดตแล้วกลับไป
    const updatedData = { is_live: liveStatus, stream_url: null, stream_title };
    res.json({ status: "success", data: updatedData });

  } catch (error) {
    console.error("PUT /api/stream error:", error.message);
    res.status(500).json({ error: "Could not update stream settings" });
  }
});
// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Backend server is running 🚀 on http://localhost:${PORT}`);
});
