import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import "./Navbar.css";

function Navbar() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  // ... (handleLogout)

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <Link to="/">Dru MindCare</Link>
        </div>
        <ul className="navbar-links">
          <li className="dropdown">
            <a href="#!" className="dropdown-toggle">
              Podcast
            </a>
            <ul className="dropdown-menu">
              <li>
                <Link to="/podcast">รายการทั้งหมด</Link>
              </li>
              <li>
                <Link to="/podcast/stream">Stream สด</Link>
              </li>
            </ul>
          </li>
          <li className="dropdown">
            <a href="#!" className="dropdown-toggle">
              บริการและเครื่องมือ
            </a>
            <ul className="dropdown-menu">
              <li>
                <Link to="/consult">ปรึกษาหมอ</Link>
              </li>
              <li>
                <Link to="/assessments">แบบประเมินตนเอง</Link>
              </li>
              <li>
                <Link to="/journal">ไดอารี่</Link>
              </li>
              <li>
                <Link to="/ai-chat">คุย AI</Link>
              </li>
            </ul>
          </li>

          {/* NEW: Show admin link only for admins */}
          {user && user.role === "admin" && (
            <>
              <li className="dropdown">
                <a href="#!" className="dropdown-toggle">
                  เครื่องมือAdmin
                </a>
                <ul className="dropdown-menu">
                  <li>
                    <Link to="/admin/dashboard">Dashboard</Link>
                  </li>
                  <li>
                    <Link to="/admin/users">จัดการผู้ใช้</Link>
                  </li>
                  <li>
                    <Link to="/admin/consult">จัดการปรึกษา</Link>
                  </li>
                </ul>
              </li>
            </>
          )}
          {user && user.role === "doctor" && (
            <li>
              <Link to="/doctor/dashboard">จัดการนัดหมาย (หมอ)</Link>
            </li>
          )}


          {/* NEW: Handle loading state */}
          {isLoading ? (
            <li>
              <span>Loading...</span>
            </li>
          ) : user ? (
            <li>
              <button
                onClick={handleLogout}
                className="navbar-button logout-button"
              >
                ออกจากระบบ ({user.username})
              </button>
            </li>
          ) : (
            <li>
              <Link to="/login" className="navbar-button">
                เข้าสู่ระบบ
              </Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;
