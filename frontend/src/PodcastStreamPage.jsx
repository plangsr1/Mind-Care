// src/PodcastStreamPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext.jsx';
import './PodcastStreamPage.css'; 
import StreamPlayer from './StreamPlayer.jsx';
import StreamBroadcaster from './StreamBroadcaster.jsx';
// --- 1. Component สำหรับแผงควบคุม (Admin/Doctor) ---
function StreamAdminPanel({ initialSettings, onStreamUpdate }) {
  const [title, setTitle] = useState(initialSettings.stream_title || 'Live Stream');
  const [isLive, setIsLive] = useState(initialSettings.is_live || false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { token } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const res = await axios.put('/api/stream', 
        {
          is_live: isLive,
          stream_title: title
          // 💡 ไม่ต้องส่ง stream_url แล้ว
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      onStreamUpdate(res.data.data); 
      alert('อัปเดตสถานะ Stream สำเร็จ!');
    } catch (err) {
      setError(err.response?.data?.error || 'ไม่สามารถอัปเดตสถานะ Stream ได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-panel">
      <h3>⚙️ แผงควบคุม Stream</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="streamTitle">ชื่อเรื่อง Stream:</label>
          <input
            id="streamTitle"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="form-group-toggle">
          <label>
            <input 
              type="checkbox"
              checked={isLive}
              onChange={(e) => setIsLive(e.target.checked)}
            />
            เริ่มถ่ายทอดสด (Go Live)
          </label>
        </div>
        <button type="submit" disabled={loading} className="btn-submit">
          {loading ? 'กำลังอัปเดต...' : 'อัปเดตสถานะ'}
        </button>
        {error && <p className="error-message">{error}</p>}
      </form>
    </div>
  );
}

// --- 2. Component สำหรับคนดู (User/Guest) ---
// 💡 ไม่ต้องแก้ไขอะไรเลย! 
//    เพราะ Jitsi ก็ทำงานผ่าน <iframe> เหมือนกัน
function StreamViewer({ settings }) {
  if (!settings.is_live || !settings.stream_url) { // 💡 เช็ก url ด้วย
    return (
      <div className="stream-placeholder">
        <span>💤</span>
        <h3>Stream ออฟไลน์อยู่ในขณะนี้</h3>
        <p>ยังไม่มีการถ่ายทอดสดในตอนนี้ กลับมาตรวจสอบอีกครั้งภายหลัง</p>
      </div>
    );
  }

  // ถ้า Live อยู่ ให้แสดง iframe
  // 💡 Jitsi จะต้องเพิ่ม allow="camera; microphone; ..."
  return (
    <div className="stream-player">
      <iframe 
        width="100%" 
        src={settings.stream_url} 
        title={settings.stream_title} 
        frameBorder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; camera; microphone" 
        allowFullScreen>
      </iframe>
    </div>
  );
}

// --- 3. Component หลักของหน้า ---
// 💡 ไม่ต้องแก้ไขอะไรเลย!
function PodcastStreamPage() {
  const { user } = useAuth();
  const [streamSettings, setStreamSettings] = useState({
    is_live: false,
    stream_url: null,
    stream_title: 'Loading...'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canStream = user && (user.role === 'admin' || user.role === 'doctor');

  useEffect(() => {
    const fetchStreamStatus = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/stream');
        setStreamSettings({
          ...res.data,
          is_live: !!res.data.is_live
        });
        setError('');
      } catch (err) {
        setError('ไม่สามารถโหลดข้อมูล Stream ได้');
      } finally {
        setLoading(false);
      }
    };
    
    fetchStreamStatus();
    const intervalId = setInterval(fetchStreamStatus, 15000); // ดึงทุก 15 วิ

    return () => clearInterval(intervalId); // Cleanup เมื่อออกจากหน้า
  }, []); 

  const handleStreamUpdate = (newSettings) => {
    setStreamSettings({
      ...newSettings,
      is_live: !!newSettings.is_live
    });
  };

  const renderStreamContent = () => {
    if (loading) {
      return <p>กำลังโหลดสถานะ Stream...</p>;
    }

    if (!streamSettings.is_live) {
      // 4.1: ถ้า Stream ปิด
      return (
        <div className="stream-placeholder">
          <span>💤</span>
          <h3>Stream ออฟไลน์อยู่ในขณะนี้</h3>
        </div>
      );
    }
    
    // 4.2: ถ้า Stream เปิด
    if (canStream) {
      // ถ้าเป็น Admin/Doctor -> ให้แสดงหน้าส่งสัญญาณ
      return <StreamBroadcaster />;
    } else {
      // ถ้าเป็น User -> ให้แสดงหน้าคนดู
      return <StreamPlayer />;
    }
  };

  return (
    <div className="stream-container">
      <h2>🎙️ {loading ? "Loading..." : streamSettings.stream_title}</h2>
      
      {/* แผงควบคุมจะแสดงให้ Admin/Doctor เห็น *เสมอ* */}
      {canStream && (
        <StreamAdminPanel 
          initialSettings={streamSettings}
          onStreamUpdate={handleStreamUpdate}
        />
      )}

      {error && <p className="error-message">{error}</p>}

      {/* 💡 5. แสดงผลเนื้อหา Stream ตาม Logic */}
      <div className="stream-content-area">
        {renderStreamContent()}
      </div>
    </div>
  );
}

export default PodcastStreamPage;