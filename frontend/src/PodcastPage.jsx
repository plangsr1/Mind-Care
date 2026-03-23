// src/PodcastPage.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import "./PodcastPage.css"; // 💡 เราจะอัปเดต CSS ในขั้นตอนที่ 3

// (ลบ getInitialState ออกแล้ว)

function PodcastPage() {
  const [podcasts, setPodcasts] = useState([]); // 💡 1. State เดียวสำหรับเก็บ Podcast ทั้งหมด
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user, token } = useAuth(); 

  // --- State สำหรับฟอร์ม (เหมือนเดิม) ---
  const [showForm, setShowForm] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [editingId, setEditingId] = useState(null); 
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('youtube'); 
  const [url, setUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [mediaFile, setMediaFile] = useState(null);

  // --- 💡 2. State ใหม่สำหรับ Pagination ---
  const [page, setPage] = useState(1); // 💡 หน้าปัจจุบัน (สำหรับ external)
  const [hasMore, setHasMore] = useState(false); // 💡 มีหน้าต่อไปอีกหรือไม่
  const [loadingMore, setLoadingMore] = useState(false); // 💡 กำลังโหลดหน้าต่อไปหรือไม่

  // 💡 3. แก้ไข useEffect (ดึงข้อมูลครั้งแรก)
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError("");
      try {
        const limit = 6; // 💡 20 รายการต่อหน้า

        // 1. ดึงข้อมูล 2 ส่วนพร้อมกัน
        const [localRes, externalRes] = await Promise.all([
          axios.get("http://localhost:3001/api/podcasts"), // (ดึง *ทั้งหมด* ที่เราอัปโหลดเอง)
          axios.get("http://localhost:3001/api/external-podcasts", { // (ดึง *หน้าแรก* 20 รายการ)
            params: { page: 1, limit: limit }
          })
        ]);
        
        const localData = localRes.data.data || [];
        const externalData = externalRes.data.data || [];
        const existingUrls = new Set(localData.map(p => p.url));
        
        // 2. กรองข้อมูลจากภายนอก (External) เฉพาะอันที่ URL ยังไม่มี
        const uniqueExternalData = externalData.filter(p => p && p.url && !existingUrls.has(p.url));
        // --- 💡 สิ้นสุดการกรอง ---
        setPodcasts([...localData, ...uniqueExternalData]); // 💡 รวมข้อมูล
        setHasMore(externalRes.data.hasMore); // 💡 ตั้งค่า 'hasMore' จาก API
        setPage(1); // 💡 ตั้งค่าหน้าปัจจุบันเป็น 1
        
      } catch (err) {
        console.error("Error fetching initial podcasts:", err);
        setError("ไม่สามารถดึงข้อมูล Podcast ได้");
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []); // 💡 ให้ดึงข้อมูลเฉพาะตอนเปิดหน้าครั้งแรก

  
  // 💡 4. ฟังก์ชันใหม่สำหรับ "โหลดเพิ่มเติม"
  const handleLoadMore = async () => {
    setLoadingMore(true);
    setError("");
    
    const nextPage = page + 1;
    const limit = 20;

    try {
      const externalRes = await axios.get("http://localhost:3001/api/external-podcasts", {
        params: { page: nextPage, limit: limit }
      });
      
      const newData = externalRes.data.data || [];
      const existingUrls = new Set(podcasts.map(p => p.url));
      
      // 2. กรองข้อมูลใหม่ (newData) เฉพาะอันที่ URL ยังไม่มี
      const uniqueNewData = newData.filter(p => p && p.url && !existingUrls.has(p.url));
      // --- 💡 สิ้นสุดการกรอง ---
      setPodcasts(prevPodcasts => [...prevPodcasts, ...uniqueNewData]); 
      
      // 4. อัปเดต 'hasMore' (ถ้าข้อมูลที่ได้มา (uniqueNewData) น้อยกว่า 20 
      //    หรือ API บอกว่าหมดแล้ว ก็แปลว่าน่าจะหมดแล้ว)
      setHasMore(externalRes.data.hasMore && uniqueNewData.length > 0);
      setPage(nextPage);

    } catch (err) {
      console.error("Error fetching more podcasts:", err);
      setError("ไม่สามารถโหลดข้อมูลเพิ่มเติมได้");
    } finally {
      setLoadingMore(false);
    }
  };

  
  // --- ฟังก์ชันสำหรับฟอร์ม (เหมือนเดิม) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    const config = { headers: { Authorization: `Bearer ${token}` } };
    let response;
    try {
      if (type === 'upload') {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('type', type);
        formData.append('mediaFile', mediaFile);
        response = await axios.post('http://localhost:3001/api/podcasts', formData, config);
      } else {
        const payload = { title, description, type, url, thumbnailUrl };
        if (editingId) {
          response = await axios.put(`http://localhost:3001/api/podcasts/${editingId}`, payload, config);
        } else {
          response = await axios.post('http://localhost:3001/api/podcasts', payload, config);
        }
      }
      const updatedOrNewPodcast = response.data.data;
      if (editingId) {
        setPodcasts(podcasts.map(p => p.id === editingId ? updatedOrNewPodcast : p));
      } else {
        // 💡 เมื่อสร้างใหม่ ให้แสดงผลด้านบนสุด (ทำงานได้ดี)
        setPodcasts([updatedOrNewPodcast, ...podcasts]); 
      }
      handleCancelEdit(); 
    } catch (err) {
      console.error('Error submitting podcast:', err);
      setSubmitError(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึก');
    }
  };
  
  const handleStartEdit = (e, podcast) => {
    e.preventDefault(); e.stopPropagation();
    setEditingId(podcast.id);
    setTitle(podcast.title);
    setDescription(podcast.description || '');
    setType(podcast.type);
    setUrl(podcast.url || '');
    setThumbnailUrl(podcast.thumbnailUrl || '');
    setMediaFile(null);
    setShowForm(true); 
    window.scrollTo(0, 0); 
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTitle(''); setDescription(''); setType('youtube');
    setUrl(''); setThumbnailUrl(''); setMediaFile(null);
    setShowForm(false); setSubmitError('');
  };

  const handleToggleAddForm = () => {
    if (showForm && !editingId) {
      handleCancelEdit();
    } else {
      handleCancelEdit(); // 💡 ล้างฟอร์มทุกครั้งที่กด "เพิ่ม"
      setShowForm(true); 
      window.scrollTo(0, 0); 
    }
  };

  const handleDelete = async (e, id) => {
    e.preventDefault(); e.stopPropagation();
    if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบ Podcast นี้?")) return;
    try {
      await axios.delete(`http://localhost:3001/api/podcasts/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPodcasts(podcasts.filter(p => p.id !== id));
    } catch (err) {
      console.error('Error deleting podcast:', err);
      alert("เกิดข้อผิดพลาดในการลบ");
    }
  };

  // --- ส่วน JSX สำหรับ Render ---
  return (
    <div className="podcast-container">
      <h1>Mental Health Podcasts</h1>

      {user && user.role === "admin" && (
        <button className="toggle-form-btn" onClick={handleToggleAddForm}>
          {showForm && !editingId ? "ซ่อนฟอร์ม" : "เพิ่ม Podcast ใหม่"}
        </button>
      )}

      {/* --- ฟอร์ม Admin (เหมือนเดิม) --- */}
      {showForm && user && user.role === "admin" && (
        <form onSubmit={handleSubmit} className="podcast-form">
          {/* ... (เนื้อหาฟอร์มเหมือนเดิม) ... */}
          <h3>{editingId ? "แก้ไข Podcast" : "เพิ่ม Podcast ใหม่"}</h3>
          {submitError && <p className="error-message">{submitError}</p>}
          <div className="form-group"> <label>Title</label> <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required /> </div>
          <div className="form-group"> <label>Description</label> <textarea value={description} onChange={(e) => setDescription(e.target.value)} /> </div>
          <div className="form-group"> <label>Type</label> <select value={type} onChange={(e) => setType(e.target.value)}> <option value="youtube">YouTube</option> <option value="upload">Upload File</option> <option value="external">จากที่อื่น (ลิงก์)</option> </select> </div>
          {(type === 'youtube' || type === 'external') && ( <div className="form-group"> <label>URL</label> <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={type === 'youtube' ? "ลิงก์ YouTube" : "ลิงก์ไปยัง Podcast (Spotify, Apple ฯ.)"} required /> </div> )}
          {type === 'upload' && ( <div className="form-group"> <label>Media File (MP4, MP3)</label> <input type="file" onChange={(e) => setMediaFile(e.target.files[0])} accept="video/*,audio/*" required={!editingId} /> </div> )}
          {(type === 'youtube' || type === 'external') && ( <div className="form-group"> <label>Thumbnail URL</label> <input type="text" value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} placeholder="ลิงก์รูปภาพปก (ถ้าเว้นว่างจะใช้รูป Default)" /> </div> )}
          <div className="form-actions"> <button type="submit" className="btn-submit"> {editingId ? "อัปเดต" : "สร้าง"} </button> <button type="button" className="btn-cancel" onClick={handleCancelEdit}> ยกเลิก </button> </div>
        </form>
      )}

      {/* --- ตารางแสดงผล (เหมือนเดิม) --- */}
      {loading && <p>Loading podcasts...</p>}
      
      <div className="podcast-grid">
        {podcasts.map((podcast) => (
          (podcast.type === 'youtube' || podcast.type === 'upload') ? (
            <Link to={`/podcast/${podcast.id}`} key={podcast.id} className="podcast-card">
              {user && user.role === 'admin' && ( <> <button className="edit-podcast-btn" onClick={(e) => handleStartEdit(e, podcast)}>✎</button> <button className="delete-podcast-btn" onClick={(e) => handleDelete(e, podcast.id)}>X</button> </> )}
              <img src={podcast.thumbnailUrl} alt={podcast.title} className="podcast-thumbnail" />
              <div className="podcast-info"> <h3 className="podcast-title">{podcast.title}</h3> <p className="podcast-description">{(podcast.description || '').substring(0, 100)}...</p> <span className={`podcast-type ${podcast.type}`}> {podcast.type === 'youtube' ? 'YouTube' : 'Uploaded'} </span> </div>
            </Link>
          ) : (
            <a href={podcast.url} target="_blank" rel="noopener noreferrer" key={podcast.id} className="podcast-card">
              <img src={podcast.thumbnailUrl} alt={podcast.title} className="podcast-thumbnail" />
              <div className="podcast-info"> <h3 className="podcast-title">{podcast.title}</h3> <p className="podcast-description">{(podcast.description || '').substring(0, 100)}...</p> <span className={`podcast-type external`}> จากที่อื่น </span> </div>
            </a>
          )
        ))}
      </div>

      {/* --- 💡 5. เพิ่มปุ่ม "โหลดเพิ่มเติม" และข้อความ --- */}
      <div className="pagination-controls">
        {error && <p className="error-message">{error}</p>}
        
        {hasMore && (
          <button 
            onClick={handleLoadMore} 
            disabled={loadingMore}
            className="load-more-btn"
          >
            {loadingMore ? "กำลังโหลด..." : "โหลดเพิ่มเติม"}
          </button>
        )}
        
        {/* แสดงข้อความนี้เมื่อโหลดจนหมดแล้ว */}
        {!loading && !hasMore && (
          <p className="end-of-list">--- สิ้นสุดรายการ ---</p>
        )}
      </div>

    </div>
  );
}

export default PodcastPage;