// src/AssessmentResultPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import './AssessmentResultPage.css'; // 💡 (เราจะสร้างไฟล์ CSS นี้)

function AssessmentResultPage() {
  const { resultId } = useParams();
  const { token } = useAuth();
  
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const res = await axios.get(`http://localhost:3001/api/assessment/result/${resultId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setResult(res.data.data);
      } catch (err) {
        setError('ไม่พบผลการประเมิน');
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [resultId, token]);

  if (loading) return <div className="result-container"><p>Loading...</p></div>;
  if (error) return <div className="result-container"><p className="error-message">{error}</p></div>;
  if (!result) return null;

  // 💡 แนะนำตามระดับคะแนน
  const getRecommendation = (score) => {
    if (score >= 10) {
      return (
        <p>
          ผลการประเมินของคุณอยู่ในระดับที่ควรปรึกษาผู้เชี่ยวชาญ 
          เราแนะนำให้คุณ <Link to="/consult">นัดหมายนักจิตวิทยา</Link> เพื่อพูดคุย
        </p>
      );
    }
    if (score >= 5) {
      return (
        <p>
          คุณมีความเครียด/ซึมเศร้าในระดับน้อย
          ลอง <Link to="/podcast">ฟัง Podcast</Link> หรือ <Link to="/ai-chat">คุยกับ AI</Link> เพื่อผ่อนคลาย
        </p>
      );
    }
    return (
      <p>
        สุขภาพจิตของคุณอยู่ในเกณฑ์ดี
        รักษาสุขภาพจิตที่ดีต่อไป!
      </p>
    );
  };

  return (
    <div className="result-container">
      <h2>ผลการประเมิน {result.assessmentName}</h2>
      
      <div className="result-card">
        <p>ทำเมื่อ: {new Date(result.timestamp).toLocaleString()}</p>
        <h3>คะแนนรวมของคุณ:</h3>
        <div className="result-score">{result.score}</div>
        <h3>ผลการประเมิน:</h3>
        <div className="result-interpretation">{result.interpretation}</div>
      </div>

      <div className="result-recommendation">
        <h3>คำแนะนำเบื้องต้น</h3>
        {getRecommendation(result.score)}
      </div>

      <p className="disclaimer">
        *การประเมินนี้เป็นการคัดกรองเบื้องต้นเท่านั้น ไม่สามารถใช้แทนการวินิจฉัยจากแพทย์ได้
      </p>
      
      <Link to="/assessments" className="back-button">
        กลับไปหน้าแบบประเมิน
      </Link>
    </div>
  );
}
export default AssessmentResultPage;