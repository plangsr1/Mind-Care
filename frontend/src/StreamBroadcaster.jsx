// src/StreamBroadcaster.jsx
import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Device } from 'mediasoup-client';

const MEDIASOUP_URL = 'http://localhost:4000';

let socket;
let device;
let sendTransport;
let videoProducer;
let audioProducer;

function StreamBroadcaster() {
  const videoRef = useRef(null);
  const localStreamRef = useRef(null); 
  
  const [streamSource, setStreamSource] = useState('idle'); // 'idle', 'camera', 'screen'
  const [error, setError] = useState('');

  // (ฟังก์ชัน initializeApi ... เหมือนเดิม ... )
  const initializeApi = async () => {
    try {
      if (!socket) {
        socket = io(MEDIASOUP_URL);
        socket.on('connect', () => console.log('Broadcaster: Socket connected'));
        await new Promise((resolve) => socket.on('connect', resolve));
        device = new Device();
        
        await new Promise((resolve, reject) => {
          socket.emit('getRouterRtpCapabilities', async (serverRtpCapabilities) => {
            try {
              console.log('Broadcaster: Got Router RtpCapabilities');
              await device.load({ routerRtpCapabilities: serverRtpCapabilities });
              resolve();
            } catch (err) {
              reject(err);
            }
          });
        });
      }

      if (!sendTransport) {
        await new Promise((resolve, reject) => {
          socket.emit('createSendTransport', async (params) => {
            if (params.error) {
              console.error('Error creating SendTransport:', params.error);
              return reject(new Error(params.error));
            }
            sendTransport = device.createSendTransport(params);
            sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
              try {
                // 💡 1. (แก้ไข) ลบ 'transportId: sendTransport.id' ออก
                socket.emit('connectSendTransport', { 
                  dtlsParameters 
                }, () => {
                  callback();
                });
              } catch (err) {
                errback(err);
              }
            });
            sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
              try {
                socket.emit('produce', { kind, rtpParameters }, (producerId) => {
                  callback({ id: producerId });
                });
              } catch (err) {
                errback(err);
              }
            });
            console.log('Broadcaster: SendTransport created');
            resolve();
          });
        });
      }
    } catch (err) {
      console.error('Initialization failed:', err);
      setError('Initialization failed. Check media-server connection.');
      throw err;
    }
  };

  // 💡 --- (ปรับปรุง) ฟังก์ชัน startStreamSource ให้ Robust ขึ้น ---
  const startStreamSource = async (sourceType) => {
    setError('');
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    try {
      if (!sendTransport) {
        await initializeApi();
      }

      let stream;
      let videoTrack = null;
      let audioTrack = null;

      if (sourceType === 'camera') {
        // --- (ปรับปรุง Camera) พยายามขอกล้องและไมค์แยกกัน ---
        let videoStream, audioStream;
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoTrack = videoStream.getVideoTracks()[0];
        } catch (vidErr) {
            console.warn("Could not get camera:", vidErr.message);
            setError("Streaming audio only (camera not found or denied).");
        }
        
        try {
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            audioTrack = audioStream.getAudioTracks()[0];
        } catch (audioErr) {
            console.warn("Could not get microphone:", audioErr.message);
            setError(prev => prev ? "No camera or mic found." : "Streaming video only (microphone not found or denied).");
        }

        if (!videoTrack && !audioTrack) {
            throw new Error("No camera or microphone found/allowed."); 
        }
        
        stream = new MediaStream();
        if (videoTrack) stream.addTrack(videoTrack);
        if (audioTrack) stream.addTrack(audioTrack);

      } else { // 'screen'
        // --- (ปรับปรุง Screen) พยายามขอไมค์, แต่ถ้าไม่เจอก็ไม่เป็นไร ---
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        videoTrack = screenStream.getVideoTracks()[0];

        let audioStream;
        try {
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            audioTrack = audioStream.getAudioTracks()[0];
        } catch (audioErr) {
            console.warn("Could not get microphone for screen share:", audioErr.message);
            setError("Streaming screen without audio (microphone not found or denied).");
            // audioTrack ยังคงเป็น null (ซึ่งโอเค)
        }
        
        stream = new MediaStream([videoTrack]);
        if (audioTrack) stream.addTrack(audioTrack);
        
        videoTrack.onended = () => {
          console.log('Screen sharing stopped by browser UI');
          stopStreaming();
        };
      }
      
      localStreamRef.current = stream;
      if (videoRef.current) {
        const previewStream = new MediaStream();
        if(videoTrack) previewStream.addTrack(videoTrack);
        videoRef.current.srcObject = previewStream; 
      }

      // --- D. (ปรับปรุง) ส่งแทร็กไปยัง Mediasoup (เฉพาะที่มี) ---
      if (videoTrack) {
        if (!videoProducer) {
            videoProducer = await sendTransport.produce({ track: videoTrack });
        } else {
            await videoProducer.replaceTrack({ track: videoTrack });
        }
      } else if (videoProducer) { // ถ้าเคยมีวิดีโอ แต่ตอนนี้ไม่มี
          videoProducer.close();
          videoProducer = null;
      }
      
      if (audioTrack) {
        if (!audioProducer) {
            audioProducer = await sendTransport.produce({ track: audioTrack });
        } else {
            await audioProducer.replaceTrack({ track: audioTrack });
        }
      } else if (audioProducer) { // ถ้าเคยมีเสียง แต่ตอนนี้ไม่มี
          audioProducer.close();
          audioProducer = null;
      }

      setStreamSource(sourceType);
      console.log(`Broadcaster: Now streaming ${sourceType}`);

    } catch (err) {
      // 💡 นี่คือจุดที่ Error ของคุณเกิดขึ้น (บรรทัด ~159)
      console.error('Error starting stream source:', err); 
      setError(`Failed to start ${sourceType}: ${err.message}`);
      stopStreaming();
    }
  };

  // (ฟังก์ชัน stopStreaming ... เหมือนเดิม ... )
  const stopStreaming = () => {
    console.log('Stopping all streams...');
    setError('');
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (videoProducer) {
      videoProducer.close();
      videoProducer = null;
    }
    if (audioProducer) {
      audioProducer.close();
      audioProducer = null;
    }
    if (sendTransport) {
      sendTransport.close();
      sendTransport = null;
    }
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    device = null;
    setStreamSource('idle');
  };
  
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, []);

  // (JSX UI ... เหมือนเดิม ... )
  return (
    <div className="webrtc-broadcaster">
      <h4>นี่คือหน้าส่งสัญญาณ (เฉพาะคุณที่เห็น)</h4>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', backgroundColor: 'black', transform: streamSource === 'camera' ? 'scaleX(-1)' : 'none' }} />
      
      <div className="broadcast-controls">
        <button 
          onClick={() => startStreamSource('camera')} 
          disabled={streamSource !== 'idle'}
          className="btn-start-stream"
        >
          📷 แชร์กล้อง
        </button>
        <button 
          onClick={() => startStreamSource('screen')} 
          disabled={streamSource !== 'idle'}
          className="btn-start-stream"
        >
          🖥️ แชร์หน้าจอ
        </button>
        <button 
          onClick={stopStreaming} 
          disabled={streamSource === 'idle'}
          className="btn-stop-stream"
        >
          🚫 หยุดถ่ายทอด
        </button>
        
        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  );
}

export default StreamBroadcaster;