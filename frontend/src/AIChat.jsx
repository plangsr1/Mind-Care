// src/AIChat.jsx

import React, { useState } from 'react';
import axios from 'axios';
import './AIChat.css';

function AIChat() {
  const [messages, setMessages] = useState([]); 
  const [input, setInput] = useState(''); 
  const [isLoading, setIsLoading] = useState(false); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { sender: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]); 
    
    // setInput(''); // <--- 1. ลบบรรทัดนี้ออกจากตรงนี้
    
    setIsLoading(true); 

    try {
      // 2. "input" ตรงนี้จะยังมีค่าที่ถูกต้องอยู่
      const response = await axios.post('http://localhost:3001/api/chat', {
        message: input, 
      });

      const aiMessage = { sender: 'ai', text: response.data.reply };
      setMessages((prev) => [...prev, aiMessage]);

    } catch (error) {
      console.error('Error fetching AI response:', error);
      const errorMessage = { sender: 'ai', text: 'ขออภัยค่ะ มีข้อผิดพลาดเกิดขึ้น' };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setInput(''); // <--- 3. ย้ายมาไว้ใน finally (จะทำงานเสมอไม่ว่าจะสำเร็จหรือล้มเหลว)
      setIsLoading(false); 
    }
  };

  // ... (ส่วน return ... ข้างล่างเหมือนเดิม) ...
// ... (วางโค้ดส่วน return ที่เหลือของคุณที่นี่) ...
  return (
    <div className="chat-container">
      <h2>คุยกับ Dru</h2>
      <h2>MindCare AI</h2>
      <p>AI ของเราพร้อมให้คำปรึกษาเบื้องต้น (นี่ไม่ใช่คำแนะนำทางการแพทย์)</p>
      
      <div className="chat-window">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender}`}>
            <p>{msg.text}</p>
          </div>
        ))}
        {isLoading && (
          <div className="message ai">
            <p className="loading-dots">...</p>
          </div>
        )}
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="พิมพ์ข้อความของคุณ..."
          autoFocus
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'กำลังส่ง...' : 'ส่ง'}
        </button>
      </form>
    </div>
  );
}

export default AIChat;