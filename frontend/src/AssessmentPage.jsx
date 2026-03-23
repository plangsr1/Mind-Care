// src/AssessmentPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import './AssessmentPage.css';

function AssessmentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  
  const [assessment, setAssessment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({}); // { questionId: score }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // 1. ดึงคำถาม
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await axios.get(`http://localhost:3001/api/assessment/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAssessment(res.data.data.assessment);
        setQuestions(res.data.data.questions);
        // สร้าง state 'answers' เริ่มต้น ให้ทุกข้อมีค่า 0
        const initialAnswers = {};
        res.data.data.questions.forEach(q => {
          initialAnswers[q.id] = 0; // คะแนนเริ่มต้น = 0
        });
        setAnswers(initialAnswers);
      } catch (err) {
        setError('ไม่สามารถดึงข้อมูลคำถามได้');
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [id, token]);

  // 2. เมื่อผู้ใช้เลือกคำตอบ
  const handleAnswerChange = (questionId, score) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: parseInt(score, 10)
    }));
  };

  // 3. เมื่อกด "ส่ง"
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // แปลง {q1: 0, q2: 1, ...} ให้เป็น [0, 1, ...]
    const answerScores = questions.map(q => answers[q.id]);
    
    // ตรวจสอบว่าทำครบทุกข้อ
    if (answerScores.some(score => score === undefined)) {
      setError('กรุณาตอบคำถามให้ครบทุกข้อ');
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post(`http://localhost:3001/api/assessment/submit`, {
        assessment_id: id,
        answers: answerScores
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // 💡 ส่งไปหน้าผลลัพธ์
      navigate(`/assessment/result/${res.data.newResultId}`);
      
    } catch (err) {
      setError('ไม่สามารถส่งคำตอบได้');
      setLoading(false);
    }
  };

  if (loading && !assessment) return <div className="assessment-container"><p>Loading...</p></div>;

  return (
    <div className="assessment-container">
      {assessment && (
        <>
          <h1>{assessment.name}</h1>
          <p>{assessment.description}</p>
          <p className="assessment-intro">
            ในช่วง 2 สัปดาห์ที่ผ่านมา ท่านมีอาการเหล่านี้บ่อยแค่ไหน?
          </p>
        </>
      )}
      
      {error && <p className="error-message">{error}</p>}
      
      <form onSubmit={handleSubmit}>
        {questions.map((q) => (
          <div key={q.id} className="question-block">
            <label className="question-text">{q.question_text}</label>
            <div className="options-group">
              {q.options.map((opt) => (
                <label key={opt.score} className="radio-label">
                  <input
                    type="radio"
                    name={`question_${q.id}`}
                    value={opt.score}
                    checked={answers[q.id] === opt.score}
                    onChange={() => handleAnswerChange(q.id, opt.score)}
                  />
                  {opt.text}
                </label>
              ))}
            </div>
          </div>
        ))}
        
        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'กำลังประมวลผล...' : 'ดูผลการประเมิน'}
        </button>
      </form>
    </div>
  );
}
export default AssessmentPage;