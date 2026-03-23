// src/StreamPlayer.jsx
import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Device } from 'mediasoup-client';

// 💡 (สำคัญ) ตรวจสอบว่า URL นี้ตรงกับ media-server.js
const MEDIASOUP_URL = 'http://localhost:4000';

let socket;
let device;
let recvTransport;

function StreamPlayer() {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  
  // 💡 1. ใช้ State/Ref เก็บ Consumers
  const [consumers, setConsumers] = useState(new Map());

  // 💡 2. ฟังก์ชัน Consume (เราจะเรียกใช้เมื่อได้รับ Event)
  const consumeStream = async (producerId, kind) => {
    if (!recvTransport || !device) {
      console.warn('Transport or Device not ready');
      return;
    }
    
    console.log(`Attempting to consume ${kind} (producerId: ${producerId})`);

    socket.emit('consumeStream', { 
        rtpCapabilities: device.rtpCapabilities,
        kind: kind,
        transportId: recvTransport.id,
        producerId: producerId // 💡 3. ส่ง producerId ที่เราเพิ่งได้รับ
      }, 
      async (params) => {
        if (params.error) {
          console.warn(`Cannot consume ${kind}: ${params.error}`);
          return;
        }

        const { id, rtpParameters } = params;

        const consumer = await recvTransport.consume({
          id,
          producerId,
          kind,
          rtpParameters,
        });

        // 💡 4. ได้ Track (วิดีโอ/เสียง) มาแล้ว
        const { track } = consumer;
        const stream = new MediaStream();
        stream.addTrack(track);

        // 💡 5. เล่นวิดีโอ/เสียง
        if (kind === 'video') {
          console.log('StreamPlayer: Playing video track');
          if (videoRef.current) videoRef.current.srcObject = stream;
        }
        if (kind === 'audio') {
          console.log('StreamPlayer: Playing audio track');
          if (audioRef.current) audioRef.current.srcObject = stream;
        }
        
        // 💡 6. เก็บ Consumer ไว้
        // (เราต้องเก็บ producerId ไว้ใน appData เพื่อใช้ตอน close)
        consumer.appData = { producerId: producerId }; 
        setConsumers(prev => new Map(prev).set(consumer.id, consumer));

        // 💡 7. บอก Server ว่าให้เริ่มส่งข้อมูลมาได้
        socket.emit('resumeConsumer', { consumerId: consumer.id }, () => {
          console.log(`Resumed ${kind} consumer (id: ${consumer.id})`);
        });
      }
    );
  };

  // 💡 8. ฟังก์ชันปิด Consumer
  const closeConsumer = (producerId) => {
    console.log(`Attempting to close consumer for producer: ${producerId}`);
    let consumerToClose = null;
    let kind = 'unknown';

    // หา consumer ที่ตรงกับ producerId
    for (const consumer of consumers.values()) {
      if (consumer.appData.producerId === producerId) {
        consumerToClose = consumer;
        kind = consumer.kind;
        break;
      }
    }
    
    if (consumerToClose) {
      consumerToClose.close();
      setConsumers(prev => {
        const newMap = new Map(prev);
        newMap.delete(consumerToClose.id);
        return newMap;
      });

      if (kind === 'video') {
        if (videoRef.current) videoRef.current.srcObject = null;
      }
      if (kind === 'audio') {
        if (audioRef.current) audioRef.current.srcObject = null;
      }
      console.log(`Closed ${kind} consumer for producer ${producerId}`);
    }
  };

  // 💡 9. useEffect (Logic หลัก)
  useEffect(() => {
    const connectAndListen = async () => {
      try {
        socket = io(MEDIASOUP_URL);
        device = new Device();

        // --- 1. เชื่อมต่อ ---
        socket.on('connect', () => {
          console.log('StreamPlayer: Socket connected');
          socket.emit('getRouterRtpCapabilities', async (serverRtpCapabilities) => {
            console.log('StreamPlayer: Got Router RtpCapabilities');
            await device.load({ routerRtpCapabilities: serverRtpCapabilities });
            
            // --- 2. สร้าง Transport (ท่อรับ) ---
            await createRecvTransport();
          });
        });
        
        // --- 3. (สำคัญ!) รอฟัง Event จาก Server ---
        socket.on('new-producer', ({ producerId, kind }) => {
          console.log(`--- Server announced new producer (kind: ${kind}) ---`);
          // เมื่อมี Stream ใหม่, ให้เราเริ่ม consume
          consumeStream(producerId, kind);
        });
        
        socket.on('producer-closed', ({ producerId }) => {
          console.log(`--- Server announced producer closed (id: ${producerId}) ---`);
          // เมื่อ Stream จบ, ให้เราปิด consumer
          closeConsumer(producerId);
        });

      } catch (error) {
        console.error("Error setting up StreamPlayer:", error);
      }
    };
    
    // 10. ฟังก์ชันสร้างท่อรับ (RecvTransport)
    const createRecvTransport = async () => {
      socket.emit('createRecvTransport', async (params) => {
        if (params.error) {
          console.error('Error creating RecvTransport:', params.error);
          return;
        }

        recvTransport = device.createRecvTransport(params);
        console.log(`StreamPlayer: RecvTransport created (id: ${recvTransport.id})`);

        recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
          try {
            socket.emit('connectRecvTransport', { 
              transportId: recvTransport.id, 
              dtlsParameters 
            }, () => {
              callback();
            });
          } catch (err) {
            errback(err);
          }
        });

        // --- 4. (สำคัญ!) เมื่อ Transport พร้อม ---
        // ถาม Server ว่า "ตอนนี้มี Stream อะไรอยู่บ้าง?"
        // (สำหรับกรณีที่เราเข้ามาช้า)
        socket.emit('get-active-producers', (activeProducers) => {
          console.log('Got active producers:', activeProducers);
          for (const { producerId, kind } of activeProducers) {
            consumeStream(producerId, kind);
          }
        });
      });
    };
    
    // --- 5. เริ่มกระบวนการ ---
    connectAndListen();

    // --- 6. Cleanup เมื่อ Component ถูกปิด ---
    return () => {
      console.log('Cleaning up StreamPlayer');
      consumers.forEach(consumer => consumer.close());
      if (recvTransport) recvTransport.close();
      if (socket) socket.disconnect();
    };
  }, []); // ทำงานครั้งเดียว

  // (JSX เหมือนเดิม)
  return (
    <div className="webrtc-player">
      <video ref={videoRef} autoPlay playsInline controls={false} style={{ width: '100%', backgroundColor: 'black' }} />
      <audio ref={audioRef} autoPlay />
    </div>
  );
}

export default StreamPlayer;