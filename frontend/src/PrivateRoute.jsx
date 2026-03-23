// src/PrivateRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

// Component นี้ทำหน้าที่เป็น "ยาม"
// ถ้าผู้ใช้ "ล็อกอินแล้ว" (ไม่ว่าจะ role ไหน) จะแสดง "children"
// ถ้า "ยังไม่ล็อกอิน" จะเด้งกลับไปหน้า login

const PrivateRoute = ({ children }) => {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return <div>Loading authentication...</div>; // รอ AuthContext โหลดเสร็จ
    }

    if (user) {
        return children; // 💡 อนุญาตให้ผ่าน (แค่ล็อกอินก็พอ)
    }

    // ถ้าไม่ใช่, ส่งกลับไปหน้า Login
    return <Navigate to="/login" replace />;
};

export default PrivateRoute;