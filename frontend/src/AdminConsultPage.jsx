// src/AdminConsultPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext.jsx';
import './AdminConsultPage.css'; // (ใช้ CSS เดิม)

// State เริ่มต้นสำหรับฟอร์ม (เพื่อใช้ล้างฟอร์ม)
const initialFormState = {
  name: '',
  title: '',
  specialty: '',
  description: '',
  photoUrl: '',
  userId: '' // 💡 เพิ่ม userId
};

function AdminConsultPage() {
  const [specialists, setSpecialists] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [availableDoctors, setAvailableDoctors] = useState([]); // 💡 State ใหม่
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { token } = useAuth();

  // State สำหรับฟอร์ม Specialist
  const [formData, setFormData] = useState(initialFormState);
  const [editMode, setEditMode] = useState(false); // false = Add, true = Edit
  const [currentSpecId, setCurrentSpecId] = useState(null);

  // --- 💡 Helper function ดึงหมอที่ว่าง ---
  const fetchAvailableDoctors = async () => {
    if (!token) return;
    try {
      const res = await axios.get('http://localhost:3001/api/users/doctors-available', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableDoctors(res.data.data);
    } catch (err) {
      console.error("Failed to fetch available doctors", err);
    }
  };
  
  // ดึงข้อมูลทั้งหมดที่ Admin ต้องใช้
  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      setLoading(true);
      setError('');
      try {
        // 1. ดึงโปรไฟล์หมอทั้งหมด (Specialists)
        const specRes = await axios.get('http://localhost:3001/api/specialists');
        setSpecialists(specRes.data.data);

        // 2. ดึงนัดหมายทั้งหมด (Appointments)
        const apptRes = await axios.get('http://localhost:3001/api/appointments/all', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAppointments(apptRes.data.data);

        // 3. ดึง User (doctor) ที่ยังไม่มีโปรไฟล์
        fetchAvailableDoctors();

      } catch (err) {
        setError("ไม่สามารถดึงข้อมูลได้");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);


  // --- 💡 ฟังก์ชันจัดการฟอร์ม (ใหม่) ---
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setCurrentSpecId(null);
    setFormData(initialFormState);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const dataToSend = {
      ...formData,
      userId: formData.userId === '' ? null : parseInt(formData.userId)
    };

    try {
      if (editMode) {
        // --- Edit Mode (PUT) ---
        const res = await axios.put(`http://localhost:3001/api/specialists/${currentSpecId}`, dataToSend, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSpecialists(prev => prev.map(s => s.id === currentSpecId ? res.data.data : s));
      } else {
        // --- Add Mode (POST) ---
        const res = await axios.post('http://localhost:3001/api/specialists', dataToSend, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSpecialists(prev => [...prev, res.data.data]);
      }
      
      handleCancelEdit(); // ล้างฟอร์ม
      fetchAvailableDoctors(); // ดึงรายชื่อหมอที่ว่างใหม่
      
    } catch (err) {
      console.error("Error submitting form:", err);
      setError(err.response?.data?.error || "เกิดข้อผิดพลาดในการบันทึก");
    }
  };

  // --- 💡 ฟังก์ชันสำหรับปุ่ม Edit / Delete (ใหม่) ---
  const handleEdit = (spec) => {
    setEditMode(true);
    setCurrentSpecId(spec.id);
    setFormData({
      name: spec.name,
      title: spec.title,
      specialty: spec.specialty || '',
      description: spec.description || '',
      photoUrl: spec.photoUrl || '',
      userId: spec.userId || '' // Set to empty string if null
    });
    window.scrollTo(0, 0); // เลื่อนไปบนสุดที่ฟอร์มอยู่
  };

  const handleDelete = async (specId) => {
    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบโปรไฟล์ ID: ${specId} ?`)) {
      try {
        await axios.delete(`http://localhost:3001/api/specialists/${specId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSpecialists(prev => prev.filter(s => s.id !== specId));
        fetchAvailableDoctors(); // ดึงรายชื่อหมอที่ว่างใหม่
      } catch (err) {
        console.error("Error deleting specialist:", err);
        setError(err.response?.data?.error || "ไม่สามารถลบได้");
      }
    }
  };

  // --- ฟังก์ชันเปลี่ยนสถานะ (จากครั้งที่แล้ว) ---
  const handleStatusChange = (appointmentId, newStatus) => {
    axios.put(
      `http://localhost:3001/api/appointments/${appointmentId}/status`,
      { status: newStatus },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    .then(response => {
      setAppointments(prevAppointments => {
        if (!Array.isArray(prevAppointments)) return [];
        return prevAppointments.map(appt =>
          appt.id === appointmentId
            ? { ...appt, status: newStatus }
            : appt
        );
      });
    })
    .catch(err => {
      console.error("Error updating status:", err);
      setError("ไม่สามารถอัปเดตสถานะได้");
    });
  };

  if (loading) return <div>กำลังโหลดข้อมูล...</div>;
  if (error && !editMode) return <p className="error-message">{error}</p>; // แสดง error หลัก

  // --- 💡 หน้าจอ (JSX) ที่อัปเกรดแล้ว ---
  return (
    <div className="admin-page-container">
      <h2>จัดการการปรึกษา</h2>
      {error && <p className="error-message">{error}</p>}

      {/* --- ส่วนที่ 1: ฟอร์มจัดการ Specialist (อัปเกรด) --- */}
      <section className="admin-section form-section">
        <h3>{editMode ? 'แก้ไขโปรไฟล์ผู้เชี่ยวชาญ' : 'เพิ่มผู้เชี่ยวชาญใหม่'}</h3>
        <form onSubmit={handleSubmit} className="specialist-form">
          {/* ... (input fields เดิม: name, title, specialty, description, photoUrl) ... */}
          <div className="input-group">
            <label>ชื่อ-นามสกุล:</label>
            <input type="text" name="name" value={formData.name} onChange={handleFormChange} required />
          </div>
          <div className="input-group">
            <label>ตำแหน่ง (เช่น จิตแพทย์, นักจิตบำบัด):</label>
            <input type="text" name="title" value={formData.title} onChange={handleFormChange} required />
          </div>
          <div className="input-group">
            <label>ความเชี่ยวชาญ (คั่นด้วย ,):</label>
            <input type="text" name="specialty" value={formData.specialty} onChange={handleFormChange} />
          </div>
          <div className="input-group">
            <label>คำอธิบายโปรไฟล์:</label>
            <textarea name="description" value={formData.description} onChange={handleFormChange} />
          </div>
          <div className="input-group">
            <label>ลิงก์รูปภาพ (URL):</label>
            <input type="text" name="photoUrl" value={formData.photoUrl} onChange={handleFormChange} />
          </div>

          {/* --- 💡 ช่อง Dropdown ใหม่สำหรับเชื่อม User --- */}
          <div className="input-group">
            <label>เชื่อมโยงกับบัญชีผู้ใช้ (Doctor):</label>
            <select name="userId" value={formData.userId} onChange={handleFormChange}>
              <option value="">-- ไม่เชื่อมโยง / ปล่อยว่าง --</option>
              
              {/* 1. แสดง User (doctor) ที่ยังว่าง */}
              {availableDoctors.map(doc => (
                <option key={doc.id} value={doc.id}>{doc.username}</option>
              ))}
              
              {/* 2. ถ้ากำลังแก้ไข, ให้แสดง User ที่กำลังเชื่อมอยู่ด้วย */}
              {editMode && formData.userId && !availableDoctors.find(d => d.id === formData.userId) && (
                <option value={formData.userId}>
                  {specialists.find(s => s.id === currentSpecId)?.linkedUsername || `(กำลังเชื่อมโยงกับ User ID: ${formData.userId})`}
                </option>
              )}
            </select>
            <small>
              *ไปที่หน้า 'จัดการผู้ใช้' เพื่อเปลี่ยนสิทธิ์ User ให้เป็น 'doctor' ก่อน*
            </small>
          </div>
          {/* --- สิ้นสุดช่อง Dropdown --- */}

          <div className="form-actions">
            <button type="submit" className="submit-btn">{editMode ? 'บันทึกการแก้ไข' : 'เพิ่มโปรไฟล์'}</button>
            {editMode && (
              <button type="button" className="cancel-btn" onClick={handleCancelEdit}>ยกเลิก</button>
            )}
          </div>
        </form>
      </section>

      {/* --- ส่วนที่ 2: ตารางแสดงผู้เชี่ยวชาญ (อัปเกรด) --- */}
      <section className="admin-section">
        <h3>รายชื่อผู้เชี่ยวชาญทั้งหมด</h3>
        <table className="admin-table specialists-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>ชื่อ</th>
              <th>ตำแหน่ง</th>
              <th>บัญชีที่เชื่อมโยง</th>
              <th>จัดการ</th> {/* 💡 คอลัมน์ใหม่ */}
            </tr>
          </thead>
          <tbody>
            {specialists.map(spec => (
              <tr key={spec.id}>
                <td>{spec.id}</td>
                <td>{spec.name}</td>
                <td>{spec.title}</td>
                <td>
                  {spec.userId 
                    ? `(ID: ${spec.userId}) ${spec.linkedUsername || ''}` 
                    : <span style={{color: '#999'}}>- ยังไม่เชื่อมโยง -</span>}
                </td>
                <td>
                  {/* --- 💡 ปุ่ม Edit / Delete --- */}
                  <button className="edit-btn" onClick={() => handleEdit(spec)}>แก้ไข</button>
                  <button className="delete-btn" onClick={() => handleDelete(spec.id)}>ลบ</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* --- ส่วนที่ 3: จัดการนัดหมาย (เหมือนเดิม) --- */}
      <section className="admin-section">
        <h3>การนัดหมายทั้งหมด</h3>
        <table className="admin-table appointments-table">
          <thead>
            <tr>
              <th>ผู้ใช้งาน</th>
              <th>ผู้เชี่ยวชาญ</th>
              <th>เวลาที่ขอ</th>
              <th>อาการเบื้องต้น</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map(appt => (
              <tr key={appt.id}>
                <td>{appt.userName}</td>
                <td>{appt.specialistName}</td>
                <td>{new Date(appt.requestedTime).toLocaleString()}</td>
                <td>{appt.reason || '-'}</td>
                <td>
                  <select
                    value={appt.status}
                    className={`status-select status-${appt.status}`}
                    onChange={(e) => handleStatusChange(appt.id, e.target.value)}
                  >
                    <option value="pending">รอการยืนยัน</option>
                    <option value="confirmed">ยืนยันแล้ว</option>
                    <option value="cancelled">ยกเลิก</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default AdminConsultPage;