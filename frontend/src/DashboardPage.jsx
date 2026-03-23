// src/DashboardPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext.jsx';
import { Line, Bar } from 'react-chartjs-2'; // 1. Import กราฟ
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import './DashboardPage.css'; // 2. สร้างไฟล์ CSS นี้ด้วย

// 3. ลงทะเบียน Components ที่จำเป็นสำหรับ Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);
const formatDate = (date) => {
    return date.toISOString().split('T')[0];
};

// --- Component ย่อยสำหรับการ์ดสถิติที่เปรียบเทียบได้ ---
function StatCard({ title, value, previousValue, format = "number" }) {
  let comparisonText = "-";
  let comparisonColor = "gray";

  if (previousValue !== undefined && previousValue !== null) {
    if (previousValue === 0) {
        // ถ้าของเดิมเป็น 0 แต่ของใหม่มีค่า
        if (value > 0) {
            comparisonText = "เพิ่มขึ้น (จาก 0)";
            comparisonColor = "green";
        }
    } else {
        const percentChange = ((value - previousValue) / previousValue) * 100;
        if (percentChange > 0) {
            comparisonText = `▲ ${percentChange.toFixed(1)}%`;
            comparisonColor = "green";
        } else if (percentChange < 0) {
            comparisonText = `▼ ${Math.abs(percentChange).toFixed(1)}%`;
            comparisonColor = "red";
        } else {
            comparisonText = "ไม่เปลี่ยนแปลง";
        }
    }
  }

  const displayValue = format === "currency" 
    ? `${value.toLocaleString()} บาท` 
    : value.toLocaleString();

  return (
    <div className="stat-card">
      <h3>{title}</h3>
      <p>{displayValue}</p>
      <span className="comparison-value" style={{ color: comparisonColor }}>
        {comparisonText}
      </span>
    </div>
  );
}
function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { token } = useAuth();
  
  // --- 💡 State ใหม่สำหรับ Date Range ---
  const [endDate, setEndDate] = useState(formatDate(new Date()));
  const [startDate, setStartDate] = useState(() => {
      const d = new Date();
      d.setDate(d.getDate() - 29); // 30 วันย้อนหลัง
      return formatDate(d);
  });
  // -------------------------------------

  // 1. แยก fetchData ออกมา
  const fetchData = async (start, end) => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      
      const config = {
        headers: { Authorization: `Bearer ${token}` },
        params: { startDate: start, endDate: end } // 💡 ส่ง Date Range ไป
      };
      
      // 💡 เรียก API ใหม่แค่เส้นเดียว
      const res = await axios.get('http://localhost:3001/api/dashboard/report', config);
      setData(res.data);

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch dashboard data');
      setData(null); // ล้างข้อมูลเก่าหาก error
    } finally {
      setLoading(false);
    }
  };

  // 2. useEffect จะเรียก fetchData ครั้งแรกเมื่อโหลด
  useEffect(() => {
    fetchData(startDate, endDate);
  }, [token]); // Run เมื่อ token พร้อม

  // 3. ฟังก์ชันสำหรับปุ่ม "ค้นหา"
  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchData(startDate, endDate);
  };
  
  // 4. ฟังก์ชันสำหรับเตรียมข้อมูลกราฟ
  const getChartData = () => {
    if (!data || !data.chartData) return null;

    const labels = data.chartData.map(d => d.date);
    const apptCounts = data.chartData.map(d => d.appointmentCount);
    const revenueData = data.chartData.map(d => d.dailyRevenue);

    return {
      appointments: {
        labels,
        datasets: [{
          label: 'จำนวนนัดหมายต่อวัน',
          data: apptCounts,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }]
      },
      revenue: {
         labels,
         datasets: [{
            label: 'รายได้ต่อวัน (บาท)',
            data: revenueData,
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
         }]
      }
    };
  };

  const chartData = getChartData(); // เรียกใช้ฟังก์ชัน

  return (
    <div className="dashboard-container">

      {/* 💡 ส่วนหัวสำหรับพิมพ์ (ซ่อนในจอปกติ) 💡 */}
      <div className="report-header-print">
        <h2>รายงานสรุปผู้ดูแลระบบ Dru MindCare</h2>
        <p><strong>ช่วงวันที่:</strong> {data?.dateRange.start} <strong>ถึง</strong> {data?.dateRange.end}</p>
        <p><strong>เปรียบเทียบกับช่วง:</strong> {data?.previousDateRange.start} <strong>ถึง</strong> {data?.previousDateRange.end}</p>
      </div>

      {/* ส่วนหัวที่แสดงบนจอ */}
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <button onClick={() => window.print()} className="print-button">
          🖨️ พิมพ์รายงาน
        </button>
      </div>

      {/* 💡 ฟอร์มสำหรับกรองวันที่ 💡 */}
      <form onSubmit={handleFilterSubmit} className="date-filter-controls">
        <div className="input-group">
          <label htmlFor="startDate">ตั้งแต่วันที่</label>
          <input 
            type="date" 
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div className="input-group">
          <label htmlFor="endDate">ถึงวันที่</label>
          <input 
            type="date" 
            id="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="filter-button" disabled={loading}>
          {loading ? 'กำลังโหลด...' : 'ค้นหา'}
        </button>
      </form>
      
      {/* --- ส่วนแสดงผล --- */}
      {loading && <div>Loading Dashboard...</div>}
      {error && <div className="error-message">{error}</div>}
      
      {data && !loading && !error && (
        <>
          {/* ส่วนที่ 1: สถิติ (ใช้ Component ใหม่) */}
          <section className="stats-grid">
            <StatCard 
              title="รายได้รวม (Paid)"
              value={data.stats.current.totalRevenue}
              previousValue={data.stats.previous.totalRevenue}
              format="currency"
            />
            <StatCard 
              title="จำนวนนัดหมายทั้งหมด"
              value={data.stats.current.totalAppointments}
              previousValue={data.stats.previous.totalAppointments}
            />
            <StatCard 
              title="นัดหมายที่ยืนยันแล้ว"
              value={data.stats.current.confirmedAppointments}
            />
            <StatCard 
              title="ผู้ใช้บริการทั้งหมด (สะสม)"
              value={data.stats.static.totalClients}
            />
          </section>

          {/* ส่วนที่ 2: กราฟ */}
          <section className="charts-section">
            <h2>สถิติรายวัน (ในช่วงวันที่เลือก)</h2>
            
            {chartData?.revenue && (
              <div className="chart-wrapper">
                <h3>รายได้</h3>
                <Bar data={chartData.revenue} />
              </div>
            )}
            {chartData?.appointments && (
              <div className="chart-wrapper">
                <h3>จำนวนนัดหมาย</h3>
                <Line data={chartData.appointments} />
              </div>
            )}
            {chartData?.appointments.labels.length === 0 && (
                <p>ไม่พบข้อมูลในช่วงวันที่ที่เลือก</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default DashboardPage;