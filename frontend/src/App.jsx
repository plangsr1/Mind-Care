// src/App.jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./Navbar.jsx";
import "./App.css";
import JournalPage from "./JournalPage.jsx";
// --- Import Pages (หน้าที่คุณมีอยู่แล้ว) ---
import AIChat from "./AIChat.jsx";
import LoginPage from "./LoginPage.jsx";
import RegisterPage from "./RegisterPage.jsx";
import ConsultPage from "./ConsultPage.jsx";
import PodcastPage from "./PodcastPage.jsx";
import PodcastDetailPage from "./PodcastDetailPage.jsx";
import PaymentPage from "./PaymentPage.jsx";
import DashboardPage from "./DashboardPage.jsx";
import UserManagementPage from "./UserManagementPage.jsx";
import AdminConsultPage from "./AdminConsultPage.jsx";
import DoctorDashboard from "./DoctorDashboard.jsx";

// --- Import Pages (ที่เราเพิ่งเพิ่ม) ---
import PrivateRoute from "./PrivateRoute.jsx";
import ChatPage from "./ChatPage.jsx";
import AssessmentListPage from "./AssessmentListPage.jsx";
import AssessmentPage from "./AssessmentPage.jsx";
import AssessmentResultPage from "./AssessmentResultPage.jsx";

// --- Import Guards (ที่คุณมีอยู่แล้ว) ---
import AdminRoute from "./AdminRoute.jsx";
import DoctorRoute from "./DoctorRoute.jsx";
import PodcastStreamPage from "./PodcastStreamPage.jsx";
// --- หน้า Home (ย้ายมาไว้ใน App.jsx เพื่อความเรียบร้อย) ---
 function Home() {
  // 💡 ลบ <div className="main-content"> ออก
  // แล้วจัดกลางข้อความด้วย inline style แทน
  return (
    <>
      <h1 style={{ textAlign: 'center' }}>ยินดีต้อนรับสู่ Dru MindCare</h1>
      <p style={{ textAlign: 'center' }}>เลือกบริการจากเมนูด้านบน</p>
    </>
  );
}

// --- 💡 โค้ดหลักของ App ---
function App() {
  return (
    <>
      <Navbar />
      <main className="main-container">
        {/* 💡 1. <Routes> เปิดตรงนี้ */}
        <Routes>
          {/* --- Public Routes (ทุกคนเข้าได้) --- */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* --- User Routes (ทั่วไป, อาจจะต้อง Login) --- */}
          <Route path="/ai-chat" element={<AIChat />} />
          <Route path="/podcast" element={<PodcastPage />} />
          <Route path="/podcast/:id" element={<PodcastDetailPage />} />
          <Route path="/podcast/stream" element={<PodcastStreamPage />} />
          <Route path="/consult" element={<ConsultPage />} />
          <Route path="/payment/:appointmentId" element={<PaymentPage />} />

          {/* --- Private Routes (ต้อง Login แน่นอน) --- */}
          <Route
            path="/chat/:appointmentId"
            element={
              <PrivateRoute>
                <ChatPage />
              </PrivateRoute>
            }
          />

          {/* 💡 2. นี่คือ Route 3 อันใหม่ที่ต้องอยู่ "ข้างใน" <Routes> */}
          <Route
            path="/assessments"
            element={
              <PrivateRoute>
                <AssessmentListPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/assessment/:id"
            element={
              <PrivateRoute>
                <AssessmentPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/assessment/result/:resultId"
            element={
              <PrivateRoute>
                <AssessmentResultPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/journal"
            element={
              <PrivateRoute>
                <JournalPage />
              </PrivateRoute>
            }
          />
          {/* --- Admin Routes --- */}
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <UserManagementPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/consult"
            element={
              <AdminRoute>
                <AdminConsultPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <DashboardPage />
              </AdminRoute>
            }
          />

          {/* --- Doctor Route --- */}
          <Route
            path="/doctor/dashboard"
            element={
              <DoctorRoute>
                <DoctorDashboard />
              </DoctorRoute>
            }
          />

          {/* (หากมี Route อื่นๆ ก็วางไว้ก่อน <Routes> ปิด) */}

          {/* 💡 3. <Routes> ปิดตรงนี้ */}
        </Routes>
      </main>
    </>
  );
}

export default App;
