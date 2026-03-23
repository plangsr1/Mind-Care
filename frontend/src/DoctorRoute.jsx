import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

// Component นี้ทำหน้าที่เป็น "ยาม"
// ถ้าผู้ใช้เป็น doctor จะแสดง "children"
// ถ้าไม่ใช่ จะเด้งกลับไปหน้าแรก
const DoctorRoute = ({ children }) => {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return <div>Loading...</div>; // รอ AuthContext โหลดเสร็จ
    }

    if (user && user.role === 'doctor') {
        return children; // อนุญาตให้ผ่าน
    }

    // ถ้าไม่ใช่, ส่งกลับไปหน้าแรก
    return <Navigate to="/" replace />;
};

export default DoctorRoute;