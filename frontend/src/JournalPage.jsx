// src/JournalPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext.jsx';
import './JournalPage.css';

// ... (ฟังก์ชัน getYYYYMMDD เหมือนเดิม) ...
const getYYYYMMDD = (date) => {
  return date.toISOString().split('T')[0];
};

// 💡 Helper: สำหรับแปลง '01' -> 'มกราคม'
const monthNames = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

function JournalPage() {
  const { token } = useAuth();
  
  // 💡 1. เพิ่ม State สำหรับ "สรุป"
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState([]); // 💡 State ใหม่
  
  // State สำหรับ "ฟอร์ม" (เหมือนเดิม)
  const [selectedDate, setSelectedDate] = useState(getYYYYMMDD(new Date()));
  const [mood, setMood] = useState(3);
  const [text, setText] = useState('');
  const [currentEntryId, setCurrentEntryId] = useState(null);
  
  const [loading, setLoading] = useState(false); // (ใช้สำหรับฟอร์ม)
  const [error, setError] = useState('');

  // 💡 2. สร้างฟังก์ชัน "รีเฟรช" (ดึงทั้ง "รายการ" และ "สรุป")
  const refreshData = async () => {
    if (!token) return;
    try {
      // 💡 ดึง 2 API พร้อมกัน
      const [entriesRes, summaryRes] = await Promise.all([
        axios.get('http://localhost:3001/api/journal', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:3001/api/journal/summary', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setEntries(entriesRes.data.data);
      setSummary(summaryRes.data.data);
    } catch (err) {
      console.error("Error refreshing data:", err);
      setError('ไม่สามารถดึงข้อมูลไดอารี่ได้');
    }
  };

  // 2. ดึง "ข้อมูล" ของวันที่เลือก (เหมือนเดิม)
  const fetchEntryForDate = async (date) => {
    // ... (โค้ดฟังก์ชันนี้เหมือนเดิม) ...
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:3001/api/journal/date/${date}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const entry = res.data.data;
      setMood(entry.mood_rating);
      setText(entry.entry_text);
      setCurrentEntryId(entry.id);
    } catch (err) {
      setMood(3);
      setText('');
      setCurrentEntryId(null);
    } finally {
      setLoading(false);
    }
  };

  // Effect: ดึงข้อมูลทั้งหมดครั้งแรก
  useEffect(() => {
    refreshData(); // 💡 3. เรียกใช้ฟังก์ชันใหม่
  }, [token]);

  // Effect: เมื่อ "วันที่เลือก" เปลี่ยน (เหมือนเดิม)
  useEffect(() => {
    if (token) {
      fetchEntryForDate(selectedDate);
    }
  }, [selectedDate, token]);

  // --- Handlers ---
  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const handleSubmit = async (e) => {
    // ... (โค้ดข้างในเหมือนเดิม) ...
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post('http://localhost:3001/api/journal', {
        entry_date: selectedDate,
        mood_rating: mood,
        entry_text: text
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      refreshData(); // 💡 4. เรียกใช้ฟังก์ชันใหม่ (แทน fetchAllEntries)
      alert("บันทึกไดอารี่สำเร็จ!");
    } catch (err) {
      setError('ไม่สามารถบันทึกไดอารี่ได้');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    // ... (โค้ดข้างในเหมือนเดิม) ...
    if (!currentEntryId || !window.confirm("คุณต้องการลบไดอารี่ของวันนี้ใช่หรือไม่?")) {
      return;
    }
    setError('');
    try {
      await axios.delete(`http://localhost:3001/api/journal/${currentEntryId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMood(3);
      setText('');
      setCurrentEntryId(null);
      refreshData(); // 💡 5. เรียกใช้ฟังก์ชันใหม่
      alert("ลบไดอารี่แล้ว");
    } catch (err) {
      setError('ไม่สามารถลบไดอารี่ได้');
    }
  };

  const handleEntryClick = (entry) => {
    setSelectedDate(entry.entry_date);
  };

  const moodToEmoji = (rating) => {
    return ['😭', '😥', '😐', '😊', '🤩'][rating - 1] || '😐';
  };

  return (
    <div className="journal-container">
      
      {/* --- 1. ฟอร์มบันทึก (เหมือนเดิม) --- */}
      <div className="journal-form-card">
        {/* ... (โค้ดฟอร์มทั้งหมดเหมือนเดิม) ... */}
        <h2>ไดอารี่สุขภาพจิต</h2>
        <form onSubmit={handleSubmit}>
          {error && <p className="error-message">{error}</p>}
          <div className="form-group"> <label>เลือกวันที่:</label> <input type="date" value={selectedDate} onChange={handleDateChange} max={getYYYYMMDD(new Date())} required /> </div>
          <div className="form-group"> <label>อารมณ์วันนี้:</label> <div className="mood-selector"> {[1, 2, 3, 4, 5].map(rating => ( <button key={rating} type="button" className={`mood-btn ${mood === rating ? 'selected' : ''}`} onClick={() => setMood(rating)}> {moodToEmoji(rating)} </button> ))} </div> </div>
          <div className="form-group"> <label>บันทึกเรื่องราว (ไม่บังคับ):</label> <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="วันนี้เจออะไรมาบ้าง..." rows={5} disabled={loading} /> </div>
          <div className="form-actions"> <button type="submit" className="btn-submit" disabled={loading}> {loading ? 'กำลังบันทึก...' : 'บันทึก'} </button> {currentEntryId && ( <button type="button" className="btn-cancel" onClick={handleDelete} disabled={loading}> ลบ </button> )} </div>
        </form>
      </div>

      {/* --- 2. รายการที่เคยบันทึก (อัปเดตใหม่) --- */}
      <div className="journal-list">
        
        {/* 💡 6. เพิ่มส่วน "สรุปรายเดือน" 💡 */}
        <h3>สรุปรายเดือน</h3>
        <div className="journal-summary-card">
          {summary.length === 0 ? (
            <p className="no-data">ยังไม่มีข้อมูลสรุป</p>
          ) : (
            <ul className="summary-list">
              {summary.map(item => {
                // แปลง '01' -> 'มกราคม'
                const monthName = monthNames[parseInt(item.month, 10) - 1];
                const avgRating = Math.round(item.avg_mood);
                
                return (
                  <li key={`${item.year}-${item.month}`}>
                    <span className="summary-month">{monthName} {item.year}</span>
                    <span className="summary-mood">{moodToEmoji(avgRating)}</span>
                    <span className="summary-detail">
                      เฉลี่ย {item.avg_mood.toFixed(1)} (บันทึก {item.entry_count} วัน)
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        
        {/* 💡 7. ส่วน "บันทึกที่ผ่านมา" (เหมือนเดิม) */}
        <h3>บันทึกที่ผ่านมา</h3>
        {entries.length === 0 ? (
          <p className="no-data">คุณยังไม่มีบันทึกไดอารี่</p>
        ) : (
          entries.map(entry => (
            <div
              key={entry.id}
              className="journal-entry-card"
              onClick={() => handleEntryClick(entry)}
            >
              {/* ... (โค้ดแสดง entry card เหมือนเดิม) ... */}
              <div className="entry-mood">{moodToEmoji(entry.mood_rating)}</div>
              <div className="entry-content">
                <div className="entry-date"> {new Date(entry.entry_date + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} </div>
                <p className="entry-text-preview"> {entry.entry_text || '(ไม่มีบันทึกข้อความ)'} </p>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}

export default JournalPage;