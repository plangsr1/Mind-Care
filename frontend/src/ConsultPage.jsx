// src/ConsultPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext.jsx';
import './ConsultPage.css'; 
import { useNavigate, Link } from 'react-router-dom'; // 💡 1. Import 'Link' เพิ่ม

function ConsultPage() {
  const [specialists, setSpecialists] = useState([]);
  const [myAppointments, setMyAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user, token } = useAuth(); 
  const navigate = useNavigate();

  // State สำหรับ Modal (หน้าต่างจองคิว)
  const [showModal, setShowModal] = useState(false);
  const [selectedSpecialist, setSelectedSpecialist] = useState(null);
  
  // State สำหรับ Form
  const [reason, setReason] = useState('');
  const [requestTime, setRequestTime] = useState('');
  const [formError, setFormError] = useState('');

  // ดึงข้อมูลหมอ และ คิวของฉัน
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        // 1. ดึงรายชื่อหมอ
        const specRes = await axios.get('http://localhost:3001/api/specialists');
        setSpecialists(specRes.data.data);

        // 2. ถ้า Login แล้ว, ดึงคิวของฉัน
        if (token) {
          const apptRes = await axios.get('http://localhost:3001/api/appointments/my', {
            headers: { Authorization: `Bearer ${token}` }
          });
          setMyAppointments(apptRes.data.data);
        }
      } catch (err) {
        setError(err.response?.data?.error || 'ไม่สามารถดึงข้อมูลได้');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]); // 💡 ให้ดึงข้อมูลใหม่ทุกครั้งที่ token (การ login) เปลี่ยน

  // --- ฟังก์ชันสำหรับ Modal (เหมือนเดิม) ---
  const handleBookClick = (specialist) => {
    if (!user) {
      navigate('/login'); // ถ้ายังไม่ login ให้ไปหน้า login
    } else {
      setSelectedSpecialist(specialist);
      setShowModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedSpecialist(null);
    setReason('');
    setRequestTime('');
    setFormError('');
  };

  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      const response = await axios.post('http://localhost:3001/api/appointments', {
        specialistId: selectedSpecialist.id,
        reason: reason,
        requestedTime: requestTime
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // 💡 อัปเดตรายการนัดหมาย (เพิ่มอันใหม่เข้าไป)
      setMyAppointments([response.data.data, ...myAppointments]);
      handleCloseModal();
      
    } catch (err) {
      setFormError(err.response?.data?.error || 'การจองล้มเหลว');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error && !loading) return <p className="error-message">{error}</p>;

  return (
    <div className="consult-container">
      
      {/* --- 💡 2. ส่วนการนัดหมายของฉัน (เพิ่มตาราง + ปุ่มแชท) --- */}
      {user && (
        <div className="my-appointments">
          <h2>การนัดหมายของฉัน</h2>
          {myAppointments.length === 0 ? (
            <p>คุณยังไม่มีการนัดหมาย</p>
          ) : (
            <table className="appointments-table"> {/* (ใช้ CSS class จาก admin/doctor) */}
              <thead>
                <tr>
                  <th>ผู้เชี่ยวชาญ</th>
                  <th>เวลา</th>
                  <th>สถานะ</th>
                  <th>การชำระเงิน</th>
                  <th>แชท</th>
                </tr>
              </thead>
              <tbody>
                {myAppointments.map(appt => (
                  <tr key={appt.id}>
                    <td>{appt.specialistName}</td>
                    <td>{new Date(appt.requestedTime).toLocaleString()}</td>
                    <td>
                      <span className={`status-tag status-${appt.status}`}>
                        {appt.status}
                      </span>
                    </td>
                    <td>
                      {/* 💡 3. เพิ่มปุ่มจ่ายเงิน/แชท */}
                      {appt.status === 'confirmed' && appt.paymentStatus !== 'paid' && (
                        <Link to={`/payment/${appt.id}`} className="payment-button">
                          ชำระเงิน
                        </Link>
                      )}
                      {appt.status === 'confirmed' && appt.paymentStatus === 'paid' && (
                        <span className="status-tag status-paid">ชำระแล้ว</span>
                      )}
                      {appt.status !== 'confirmed' && (
                        <span>-</span>
                      )}
                    </td>
                    <td>
                      {/* 💡 4. นี่คือปุ่มแชทที่เพิ่มเข้ามา! */}
                      {appt.status === 'confirmed' ? (
                        <Link to={`/chat/${appt.id}`} className="chat-button">
                          เข้าแชท
                        </Link>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}


      {/* --- ส่วนแสดงผู้เชี่ยวชาญ (เหมือนเดิม) --- */}
      <div className="specialist-header">
        <h2>เลือกผู้เชี่ยวชาญ</h2>
        {!user && <p>กรุณา <Link to="/login">เข้าสู่ระบบ</Link> เพื่อทำการนัดหมาย</p>}
      </div>
      
      <div className="specialist-grid">
        {specialists.map(spec => (
          <div key={spec.id} className="specialist-card">
            <img src={spec.photoUrl || 'https://via.placeholder.com/150'} alt={spec.name} className="specialist-photo" />
            <div className="specialist-info">
              <h3>{spec.name}</h3>
              <p className="specialist-title">{spec.title}</p>
              <p className="specialist-specialty"><b>เชี่ยวชาญ:</b> {spec.specialty}</p>
              <p className="specialist-desc">{spec.description}</p>
              <button
                className="book-btn"
                onClick={() => handleBookClick(spec)}
                disabled={!user} // 💡 ปิดปุ่มถ้ายังไม่ login
              >
                นัดหมาย (฿{spec.price || 1000})
              </button>
            </div>
          </div>
        ))}
      </div>


      {/* --- Modal (เหมือนเดิม) --- */}
      {showModal && selectedSpecialist && (
        <div className="modal-backdrop" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmitBooking}>
              <h3>นัดหมายคุณ {selectedSpecialist.name}</h3>
              <div className="input-group">
                <label>อาการเบื้องต้น (ไม่บังคับ)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="เช่น รู้สึกกังวล, นอนไม่หลับ..."
                />
              </div>
              <div className="input-group">
                <label>เลือกวันและเวลาที่สะดวก</label>
                <input
                  type="datetime-local"
                  value={requestTime}
                  onChange={(e) => setRequestTime(e.target.value)}
                  required
                />
              </div>
              {formError && <p className="error-message">{formError}</p>}
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={handleCloseModal}>
                  ยกเลิก
                </button>
                <button type="submit" className="submit-btn">
                  ส่งคำขอ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default ConsultPage;