// d:\mind-care\frontend\src\RegisterPage.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import './AuthForm.css'; // ใช้ CSS ร่วมกับหน้า Login

function RegisterPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); // ล้าง error เก่า

        try {
            await axios.post('http://localhost:3001/api/register', { 
                username: username, 
                password: password 
            });
            // ถ้าสำเร็จ, ส่งไปหน้า Login
            navigate('/login');
        } catch (err) {
            if (err.response && err.response.data.error) {
                setError(err.response.data.error); // แสดง error จาก backend (เช่น "Username already exists")
            } else {
                setError('การสมัครสมาชิกล้มเหลว');
            }
        }
    };

    return (
        <div className="auth-container">
            <form className="auth-form" onSubmit={handleSubmit}>
                <h2>สมัครสมาชิก</h2>
                <div className="input-group">
                    <label htmlFor="username">ชื่อผู้ใช้</label>
                    <input 
                        type="text" 
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required 
                    />
                </div>
                <div className="input-group">
                    <label htmlFor="password">รหัสผ่าน</label>
                    <input 
                        type="password" 
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required 
                    />
                </div>
                {error && <p className="error-message">{error}</p>}
                <button type="submit" className="auth-button">สมัครสมาชิก</button>
                <p className="switch-link">
                    มีบัญชีอยู่แล้ว? <Link to="/login">เข้าสู่ระบบที่นี่</Link>
                </p>
            </form>
        </div>
    );
}

export default RegisterPage;