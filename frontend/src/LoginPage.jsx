// d:\mind-care\frontend\src\LoginPage.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx'; // 1. Import "สมอง"
import './AuthForm.css';

function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const auth = useAuth(); // 2. เรียกใช้ "สมอง"

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const response = await axios.post('http://localhost:3001/api/login', { 
                username: username, 
                password: password 
            });
            
            // 3. ถ้าสำเร็จ, เรียกฟังก์ชัน login จาก "สมอง"
            auth.login(response.data.token); 
            
            // 4. ส่งกลับไปหน้าแรก
            navigate('/');
        } catch (err) {
            setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        }
    };

    return (
        <div className="auth-container">
            <form className="auth-form" onSubmit={handleSubmit}>
                <h2>เข้าสู่ระบบ</h2>
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
                <button type="submit" className="auth-button">เข้าสู่ระบบ</button>
                <p className="switch-link">
                    ยังไม่มีบัญชี? <Link to="/register">สมัครสมาชิก</Link>
                </p>
            </form>
        </div>
    );
}

export default LoginPage;