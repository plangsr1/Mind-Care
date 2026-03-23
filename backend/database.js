// database.js
const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./mindcare.db", (err) => {
  if (err) {
    console.error("Error opening database", err.message);
  } else {
    console.log("Connected to the SQLite database.");
    createTables();
  }
});

// --- 💡 1. ย้าย Helper Functions มาไว้ที่นี่ (จาก server.js) ---
const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this); 
    });
  });
};

// --- 💡 2. ย้ายฟังก์ชัน Seed มาไว้ที่นี่ (จาก server.js) ---
async function seedAssessments() {
  try {
    const phq9 = await dbGet(`SELECT id FROM assessments WHERE name = 'PHQ-9'`);
    if (phq9) {
      // console.log("PHQ-9 already exists.");
      return; 
    }
    console.log("Seeding PHQ-9 Assessment...");

    const result = await dbRun(
      `INSERT INTO assessments (name, description) VALUES (?, ?)`,
      ['PHQ-9', 'แบบประเมินภาวะซึมเศร้า 9 ข้อ (PHQ-9)']
    );
    const assessmentId = result.lastID;

    const questions = [
      "1. มีอาการเบื่อ ไม่สนใจอยากทำอะไร",
      "2. ไม่สบายใจ ซึมเศร้า ท้อแท้",
      "3. หลับยาก หรือหลับๆ ตื่นๆ หรือหลับมากไป",
      "4. เหนื่อยง่าย หรือไม่ค่อยมีแรง",
      "5. เบื่ออาหาร หรือกินมากเกินไป",
      "6. รู้สึกไม่ดีกับตัวเอง (คิดว่าตัวเองล้มเหลว หรือทำให้ตนเองหรือครอบครัวผิดหวัง)",
      "7. สมาธิไม่ดีเวลาทำอะไร (เช่น ดูโทรทัศน์ ฟังวิทยุ หรือทำงานที่ต้องใช้ความตั้งใจ)",
      "8. พูดช้า ทำอะไรช้าลง (จนคนอื่นสังเกตเห็น) หรือกระสับกระส่าย ไม่สามารถอยู่นิ่งได้",
      "9. คิดทำร้ายตนเอง หรือคิดว่าถ้าตายไปคงจะดี"
    ];
    
    const optionsJson = JSON.stringify([
      { "text": "ไม่มีเลย", "score": 0 },
      { "text": "มีบางวัน (1-7 วัน)", "score": 1 },
      { "text": "มีบ่อยๆ (มากกว่า 7 วัน)", "score": 2 },
      { "text": "มีเกือบทุกวัน", "score": 3 }
    ]);

    for (let i = 0; i < questions.length; i++) {
      await dbRun(
        `INSERT INTO assessment_questions (assessment_id, question_order, question_text, options_json) VALUES (?, ?, ?, ?)`,
        [assessmentId, i + 1, questions[i], optionsJson]
      );
    }
    console.log("PHQ-9 Seeding complete.");
  } catch (error) {
    console.error("Error seeding assessments:", error.message);
  }
}
async function seedStreamSettings() {
  try {
    const row = await dbGet("SELECT * FROM stream_settings WHERE id = 1");
    if (!row) {
      // 💡 3. ตรวจสอบว่ามีแถวหรือยัง ถ้ายัง ให้เพิ่มแถว default (offline)
      await dbRun(
        "INSERT INTO stream_settings (id, is_live, stream_title, stream_url) VALUES (1, 0, 'Stream Offline', NULL)"
      );
      console.log("Default stream settings seeded.");
    }
  } catch (err) {
    console.error("Error seeding stream settings:", err.message);
  }
}


// --- 3. ฟังก์ชันสร้างตาราง (เหมือนเดิม) ---
function createTables() {
  // ... (โค้ดสร้างตาราง users, podcasts, specialists, appointments, chat_messages ของเดิม) ...
  // (ตรวจสอบว่าโค้ดสร้างตาราง 5 ตารางแรกยังอยู่ครบ)
const createStreamSettingsTableSql = `
    CREATE TABLE IF NOT EXISTS stream_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      is_live INTEGER DEFAULT 0,
      stream_url TEXT,
      stream_title TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;
  db.run(createStreamSettingsTableSql, (err) => {
    if (err) console.error("Error creating stream_settings table", err.message);
    else {
      console.log("stream_settings table is ready.");
      // 💡 4. เรียกใช้ seeder
      seedStreamSettings(); 
    }
  });
  // 1. ตารางเก็บ "ชื่อ" แบบทดสอบ
  const createAssessmentsTableSql = `
    CREATE TABLE IF NOT EXISTS assessments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT
    );`;
  db.run(createAssessmentsTableSql);

  // 2. ตารางเก็บ "คำถาม" ของแต่ละแบบทดสอบ
  const createAssessmentQuestionsTableSql = `
    CREATE TABLE IF NOT EXISTS assessment_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assessment_id INTEGER NOT NULL REFERENCES assessments(id),
        question_order INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        options_json TEXT NOT NULL 
    );`;
  db.run(createAssessmentQuestionsTableSql);
  
  // 3. ตารางเก็บ "ผลลัพธ์" ของผู้ใช้
  const createAssessmentResultsTableSql = `
    CREATE TABLE IF NOT EXISTS assessment_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        assessment_id INTEGER NOT NULL REFERENCES assessments(id),
        score INTEGER NOT NULL,
        interpretation TEXT NOT NULL, 
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );`;
  db.run(createAssessmentResultsTableSql, (err) => {
    if (err) console.error("Error creating assessment tables", err.message);
    else {
      console.log("Assessment tables are ready.");
      // 💡 4. จุดนี้จะทำงานถูกต้องแล้ว
      seedAssessments(); 
    }
  });
  db.run(createAssessmentResultsTableSql, (err) => {
    if (err) console.error("Error creating assessment tables", err.message);
    else {
      console.log("Assessment tables are ready.");
      seedAssessments(); 
    }
  });

  // --- 💡 1. เพิ่มตารางนี้สำหรับเก็บไดอารี่ ---
  const createJournalEntriesTableSql = `
    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      entry_date TEXT NOT NULL,       -- วันที่ของไดอารี่ (YYYY-MM-DD)
      mood_rating INTEGER NOT NULL,   -- อารมณ์ (1-5)
      entry_text TEXT,                -- ข้อความไดอารี่
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      -- 💡 2. ตั้งค่าให้ 1 user สามารถมีไดอารี่ 1 entry ต่อ 1 วัน
      UNIQUE(user_id, entry_date) 
    );`;
    
  db.run(createJournalEntriesTableSql, (err) => {
    if (err) console.error("Error creating journal_entries table", err.message);
    else console.log("Journal entries table is ready.");
  });

  // ... (โค้ดสร้างตาราง notifications ของเดิม) ...
}

// --- 💡 5. เพิ่ม module.exports ที่ท้ายไฟล์ ---
module.exports = {
  db,
  dbGet,
  dbAll,
  dbRun,
  createTables
};