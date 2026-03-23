// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // 💡 --- เพิ่มส่วนนี้เข้าไป --- 💡
  server: {
    proxy: {
      // ถ้า path เริ่มต้นด้วย /api
      '/api': {
        target: 'http://localhost:3001', // 🎯 ที่อยู่ของ Backend Server
        changeOrigin: true, // จำเป็นสำหรับการเปลี่ยน Host Header
        secure: false,      // ถ้า backend ของคุณเป็น http (ไม่ใช่ https)
      }
    }
  }
  // 💡 --- สิ้นสุดส่วนที่เพิ่ม --- 💡
})