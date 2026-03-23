// src/PodcastDetailPage.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import "./PodcastDetailPage.css"; // สร้างไฟล์ CSS นี้

function PodcastDetailPage() {
  const [podcast, setPodcast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { id } = useParams();

  useEffect(() => {
    const fetchPodcast = async () => {
      try {
        const response = await axios.get(`http://localhost:3001/api/podcasts/${id}`);
        setPodcast(response.data.data);
      } catch (err) {
        setError("ไม่พบ Podcast ที่คุณค้นหา");
      } finally {
        setLoading(false);
      }
    };
    fetchPodcast();
  }, [id]);

  // --- 💡 นี่คือฟังก์ชันที่แก้ไขใหม่ 💡 ---
  // ฟังก์ชันนี้จะแปลงลิงก์ YouTube ทุกรูปแบบ (watch, youtu.be, embed)
  // ให้เป็นลิงก์ /embed/ ที่ถูกต้องสำหรับ iframe
  const getYouTubeEmbedUrl = (url) => {
    if (!url) return ''; // กัน error ถ้า url เป็น null

    let videoId = '';
    
    // Regex นี้จะดึง Video ID จากลิงก์ YouTube ทุกรูปแบบ
    // (watch?v=, youtu.be/, /embed/, /v/)
    try {
      const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
      const match = url.match(regex);
      
      if (match && match[1]) {
        videoId = match[1];
      }
    } catch (e) {
      console.error("Error parsing YouTube URL:", url, e);
      return ''; // ถ้าพัง ก็ไม่แสดงผล
    }

    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
    
    // ถ้าไม่ตรงเลย (อาจจะเป็น URL ที่พัง)
    console.warn("Could not extract YouTube ID from:", url);
    return ''; // คืนค่าว่างไปเลย
  };
  // --- สิ้นสุดฟังก์ชันที่แก้ไข ---

  if (loading) return <div className="podcast-detail-container"><p>กำลังโหลด...</p></div>;
  if (error) return <div className="podcast-detail-container"><p className="error-message">{error}</p></div>;
  if (!podcast) return null;

  // เราจะเรียกใช้ฟังก์ชันแปลงลิงก์ที่นี่
  const videoSrc = podcast.type === "youtube" 
    ? getYouTubeEmbedUrl(podcast.url) 
    : podcast.url; // สำหรับ 'upload' มันควรเป็น http://localhost:3001/... อยู่แล้ว

  return (
    <div className="podcast-detail-container">
      <h2>{podcast.title}</h2>
      
      <div className="podcast-player-wrapper">
        
        {/* แก้ไขส่วนการแสดงผล */}
        {podcast.type === "youtube" ? (
          <iframe
            width="100%"
            height="400"
            src={videoSrc} // ใช้ videoSrc ที่แปลงแล้ว
            title={podcast.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        ) : (
          <video
            width="100%"
            height="400"
            controls
            src={videoSrc} // นี่คือ URL ที่ชี้ไป http://localhost:3001/uploads/media/file.mp4
          >
            Your browser does not support the video tag.
          </video>
        )}
        
        {/* เพิ่มส่วนตรวจสอบ URL (สำหรับ Debug ถ้าลิงก์พัง) */}
        {videoSrc === '' && podcast.type === 'youtube' && (
          <p className="error-message">ไม่สามารถแสดงผล YouTube video ได้: URL ไม่ถูกต้อง ({podcast.url})</p>
        )}

      </div>

      <div className="podcast-content-description">
        <h3>รายละเอียด:</h3>
        <p>{podcast.description}</p>
      </div>
    </div>
  );
}

export default PodcastDetailPage;