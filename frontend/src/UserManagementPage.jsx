import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "./AuthContext.jsx";
import "./UserManagement.css"; // We'll create this CSS file next

function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { token } = useAuth();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get("http://localhost:3001/api/users", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setUsers(response.data.data);
      } catch (err) {
        setError("ไม่สามารถดึงข้อมูลผู้ใช้ได้");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchUsers();
    }
  }, [token]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await axios.put(
        `http://localhost:3001/api/users/${userId}/role`,
        { role: newRole },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      // Update the user's role in the local state to reflect the change immediately
      setUsers(
        users.map((user) =>
          user.id === userId ? { ...user, role: newRole } : user
        )
      );
    } catch (err) {
      alert("อัปเดตสิทธิ์ล้มเหลว");
    }
  };
  const handleDeleteUser = async (userId) => {
    if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้นี้?")) return;

    try {
      await axios.delete(`http://localhost:3001/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // ลบออกจาก state เพื่ออัปเดตทันที
      setUsers(users.filter((user) => user.id !== userId));
    } catch (err) {
      alert("ลบผู้ใช้ล้มเหลว");
    }
  };

  if (loading)
    return (
      <div className="management-container">
        <p>กำลังโหลด...</p>
      </div>
    );
  if (error)
    return (
      <div className="management-container">
        <p className="error-message">{error}</p>
      </div>
    );

  return (
    <div className="management-container">
      <h2>จัดการผู้ใช้งาน</h2>
      <table className="users-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td>{user.username}</td>
              <td>{user.role}</td>
              <td>
                <select
                  value={user.role}
                  onChange={(e) => handleRoleChange(user.id, e.target.value)}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="doctor">Doctor</option>
                </select>
                &nbsp;
                <button
                  onClick={() => handleDeleteUser(user.id)}
                  style={{
                    backgroundColor: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    padding: "6px 10px",
                    cursor: "pointer",
                  }}
                >
                  ลบ
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default UserManagementPage;
