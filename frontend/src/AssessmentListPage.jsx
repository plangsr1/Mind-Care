// src/AssessmentListPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import './AssessmentPage.css'; // 💡 (เราจะสร้างไฟล์ CSS นี้)

function AssessmentListPage() {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { token } = useAuth();

  useEffect(() => {
    const fetchAssessments = async () => {
      try {
        const res = await axios.get('http://localhost:3001/api/assessments', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAssessments(res.data.data);
      } catch (err) {
        setError('ไม่สามารถดึงข้อมูลแบบประเมินได้');
      } finally {
        setLoading(false);
      }
    };
    fetchAssessments();
  }, [token]);

  if (loading) return <div className="assessment-container"><p>Loading...</p></div>;
  if (error) return <div className="assessment-container"><p className="error-message">{error}</p></div>;

  return (
    <div className="assessment-container">
      <h1>แบบประเมินตนเอง</h1>
      <p>เลือกแบบประเมินที่คุณต้องการทำ</p>
      <div className="assessment-list">
        {assessments.map(test => (
          <Link key={test.id} to={`/assessment/${test.id}`} className="assessment-card">
            <h3>{test.name}</h3>
            <p>{test.description}</p>
            <button className="start-btn">เริ่มทำแบบประเมิน</button>
          </Link>
        ))}
      </div>
    </div>
  );
}
export default AssessmentListPage;