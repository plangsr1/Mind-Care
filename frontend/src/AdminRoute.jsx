import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

// Component นี้ทำหน้าที่เป็น "ยาม"
// ถ้าผู้ใช้เป็น admin จะแสดง "children" (หน้าที่อยู่ข้างใน)
// ถ้าไม่ใช่ จะเด้งกลับไปหน้าแรก
const AdminRoute = ({ children }) => {
    const { user } = useAuth();

    // ตรวจสอบว่า user โหลดเสร็จหรือยัง และ user เป็น admin หรือไม่
    if (user && user.role === 'admin') {
        return children; // อนุญาตให้ผ่าน
    }

    // ถ้าไม่ใช่, ส่งกลับไปหน้าแรก
    return <Navigate to="/" replace />;
};

export default AdminRoute;

