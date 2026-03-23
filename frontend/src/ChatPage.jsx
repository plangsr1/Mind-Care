// src/ChatPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import './ChatPage.css'; // เราจะสร้างไฟล์นี้ในขั้นตอนที่ 5

function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [appointmentInfo, setAppointmentInfo] = useState(null); // เก็บข้อมูลหมอ/คนไข้
  
  const { appointmentId } = useParams();
  const { user, token } = useAuth();
  
  // 💡 Ref สำหรับเลื่อน scroll ลงล่างสุด
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 1. ดึงข้อมูลแชททั้งหมด
  useEffect(() => {
    const fetchChat = async () => {
      if (!token) return;
      try {
        setLoading(true);
        const res = await axios.get(`http://localhost:3001/api/chat/${appointmentId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessages(res.data.data.messages);
        setAppointmentInfo({
          patient: res.data.data.patient,
          doctor: res.data.data.doctor
        });
        setError('');
      } catch (err) {
        setError(err.response?.data?.error || 'ไม่สามารถโหลดแชทได้');
      } finally {
        setLoading(false);
      }
    };
    fetchChat();
  }, [appointmentId, token]);

  // 2. เลื่อนลงล่างสุด เมื่อ messages เปลี่ยน
  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  // 3. ฟังก์ชันส่งข้อความ
  const handleSend = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === '') return;

    try {
      const res = await axios.post(
        `http://localhost:3001/api/chat/${appointmentId}`,
        { message: newMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // 💡 เพิ่มข้อความใหม่เข้าไปใน state
      setMessages(prevMessages => [...prevMessages, res.data.data]);
      setNewMessage(''); // ล้างช่อง input
      
    } catch (err) {
      setError(err.response?.data?.error || 'ส่งข้อความไม่สำเร็จ');
    }
  };

  if (loading) return <div className="chat-container"><p>กำลังโหลดแชท...</p></div>;

  // 💡 หาว่าคู่สนทนาคือใคร
  const getChatPartnerName = () => {
    if (!appointmentInfo || !user) return "Loading...";
    return user.id === appointmentInfo.patient.id 
      ? appointmentInfo.doctor.username 
      : appointmentInfo.patient.username;
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>แชทกับ: {getChatPartnerName()}</h3>
        <p>(สำหรับการนัดหมาย ID: {appointmentId})</p>
      </div>

      {error && <p className="error-message">{error}</p>}

      <div className="message-list">
        {messages.map(msg => (
          <div
            key={msg.id}
            // 💡 ตรวจสอบว่าเป็นข้อความ "ของฉัน" หรือ "ของเขา"
            className={`message-bubble ${msg.senderId === user.id ? 'my-message' : 'their-message'}`}
          >
            <p className="message-text">{msg.message}</p>
            <span className="message-timestamp">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        {/* 💡 ตัวคั่นสำหรับเลื่อน scroll */}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSend}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="พิมพ์ข้อความ..."
        />
        <button type="submit">ส่ง</button>
      </form>
    </div>
  );
}

export default ChatPage;