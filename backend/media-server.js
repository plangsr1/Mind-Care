// backend/media-server.js

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mediasoup = require('mediasoup');
const cors = require('cors');

// --- 1. การตั้งค่าเซิร์ฟเวอร์ ---
const PORT = 4000;
const app = express();
app.use(cors());
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    methods: ['GET', 'POST'],
  },
});

// --- 2. การตั้งค่า Mediasoup ---
const MEDIASOUP_LISTEN_IP = '127.0.0.1';
const MEDIASOUP_ANNOUNCE_IP = null; 

let worker;
let router;

// --- 3. สถานะของ "ผู้ถ่ายทอดสด" (Broadcaster) ---
let broadcaster = {
  transport: null,
  videoProducer: null,
  audioProducer: null,
  socketId: null,
};

// --- 4. ฟังก์ชันเริ่ม Mediasoup Worker ---
const startMediasoup = async () => {
  worker = await mediasoup.createWorker({
    logLevel: 'warn',
  });

  worker.on('died', () => {
    console.error('Mediasoup worker has died');
    process.exit(1);
  });

  const mediaCodecs = [
    { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 },
    { kind: 'video', mimeType: 'video/VP8', clockRate: 90000, parameters: { 'x-google-start-bitrate': 1000 } },
  ];
  router = await worker.createRouter({ mediaCodecs });
  router.appData.consumers = new Map();
  console.log('Mediasoup Router created');
};

// --- 5. เริ่มต้นทุกอย่าง ---
startMediasoup().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Media server (Mediasoup) is running on http://localhost:${PORT}`);
  });
});

// --- 6. Logic หลัก: การเชื่อมต่อ Socket.IO ---
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  
  const consumersBySocket = new Map();
  // 💡 (FIX 2.1) เพิ่มที่เก็บ recvTransport ใน socket
  socket.appData = { consumers: consumersBySocket, recvTransport: null };


  // --- A. Events ทั่วไป ---
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    
    if (socket.id === broadcaster.socketId) {
      console.log('Broadcaster disconnected. Stopping stream.');
      if (broadcaster.videoProducer) {
        socket.broadcast.emit('producer-closed', { producerId: broadcaster.videoProducer.id });
      }
      if (broadcaster.audioProducer) {
        socket.broadcast.emit('producer-closed', { producerId: broadcaster.audioProducer.id });
      }
      broadcaster.transport = null;
      broadcaster.videoProducer = null;
      broadcaster.audioProducer = null;
      broadcaster.socketId = null;
    }
    socket.appData.consumers.forEach(consumer => consumer.close());
  });

  socket.on('getRouterRtpCapabilities', (callback) => {
    callback(router.rtpCapabilities);
  });
  
  socket.on('get-active-producers', (callback) => {
    const activeProducers = [];
    if (broadcaster.videoProducer) {
      activeProducers.push({ producerId: broadcaster.videoProducer.id, kind: broadcaster.videoProducer.kind });
    }
    if (broadcaster.audioProducer) {
      activeProducers.push({ producerId: broadcaster.audioProducer.id, kind: broadcaster.audioProducer.kind });
    }
    callback(activeProducers);
  });


  // --- B. Events สำหรับผู้ถ่ายทอดสด (Broadcaster) ---

  socket.on('createSendTransport', async (callback) => {
    try {
      const transport = await router.createWebRtcTransport({
        listenIps: [{ ip: MEDIASOUP_LISTEN_IP, announcedIp: MEDIASOUP_ANNOUNCE_IP }],
        enableUdp: true, enableTcp: true, preferUdp: true,
      });

      broadcaster.transport = transport;
      broadcaster.socketId = socket.id;
      transport.appData = { socketId: socket.id, isBroadcaster: true };

      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });
    } catch (e) {
      console.error('Error creating SendTransport', e);
      callback({ error: e.message });
    }
  });

  // 💡 --- (FIX 1) ---
  // นี่คือฟังก์ชันที่แก้ไขแล้วสำหรับ Broadcaster (จากครั้งที่แล้ว)
  socket.on('connectSendTransport', async ({ dtlsParameters }, callback) => {
    console.log(`[${socket.id}] connectSendTransport`);
    
    // (ใช้ transport ที่เก็บในตัวแปร broadcaster โดยตรง)
    if (!broadcaster.transport) {
      console.error(`[${socket.id}] Broadcaster transport not found`);
      return callback({ error: 'Broadcaster transport not found' });
    }
    
    try {
      await broadcaster.transport.connect({ dtlsParameters });
      callback();
    } catch (e) {
      console.error('connectSendTransport error:', e);
      callback({ error: e.message });
    }
  });

  socket.on('produce', async ({ kind, rtpParameters }, callback) => {
    // ... (โค้ดส่วนนี้ถูกต้อง ไม่ต้องแก้ไข) ...
    if (!broadcaster.transport) return callback({ error: 'No transport' });
    const producer = await broadcaster.transport.produce({ kind, rtpParameters });
    if (kind === 'video') broadcaster.videoProducer = producer;
    if (kind === 'audio') broadcaster.audioProducer = producer;
    console.log(`--- New Producer created (kind: ${kind}, id: ${producer.id}) ---`);
    socket.broadcast.emit('new-producer', {
      producerId: producer.id,
      kind: producer.kind
    });
    callback({ id: producer.id });
  });

  // --- C. Events สำหรับผู้รับชม (Consumer) ---

  // 💡 --- (FIX 2.2) ---
  // (แก้ไขฟังก์ชัน createRecvTransport)
  socket.on('createRecvTransport', async (callback) => {
    console.log(`[${socket.id}] createRecvTransport`);
    try {
      const transport = await router.createWebRtcTransport({
        listenIps: [{ ip: MEDIASOUP_LISTEN_IP, announcedIp: MEDIASOUP_ANNOUNCE_IP }],
      });
      transport.appData = { socketId: socket.id };
      
      // (เก็บ transport ไว้ใน socket เพื่อใช้ในฟังก์ชันถัดไป)
      socket.appData.recvTransport = transport;

      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });
    } catch (e) {
      console.error('Error creating RecvTransport', e);
      callback({ error: e.message });
    }
  });

  // 💡 --- (FIX 2.3) ---
  // (แก้ไขฟังก์ชัน connectRecvTransport - นี่คือบรรทัด 146 ที่แครช)
  socket.on('connectRecvTransport', async ({ transportId, dtlsParameters }, callback) => {
    console.log(`[${socket.id}] connectRecvTransport`);
    
    // (ใช้ transport ที่เราเพิ่งเก็บไว้ใน socket.appData)
    const transport = socket.appData.recvTransport;
    
    if (!transport || transport.id !== transportId) {
       console.error(`[${socket.id}] RecvTransport not found or ID mismatch`);
       return callback({ error: 'Transport not found' });
    }

    try {
      await transport.connect({ dtlsParameters });
      callback();
    } catch (e) {
      console.error('connectRecvTransport error:', e);
      callback({ error: e.message });
    }
  });

  socket.on('consumeStream', async ({ rtpCapabilities, kind, transportId, producerId }, callback) => {
    // ... (โค้ดส่วนนี้ถูกต้อง ไม่ต้องแก้ไข) ...
    let producerToConsume;
    if (producerId) {
      producerToConsume = Array.from(router.producers.values()).find(p => p.id === producerId);
    } else {
      producerToConsume = (kind === 'video') ? broadcaster.videoProducer : broadcaster.audioProducer;
    }

    if (!producerToConsume || !router.canConsume({ producerId: producerToConsume.id, rtpCapabilities })) {
      return callback({ error: `Cannot consume ${kind}` });
    }
    
    const transport = socket.appData.recvTransport; // 💡 (ใช้ transport ที่เก็บไว้)
    if (!transport || transport.id !== transportId) {
        return callback({error: 'Transport not found'});
    }

    try {
      const consumer = await transport.consume({
        producerId: producerToConsume.id,
        rtpCapabilities,
        paused: true,
      });

      router.appData.consumers.set(consumer.id, consumer);
      socket.appData.consumers.set(consumer.id, consumer); 
      consumer.appData = { producerId: producerToConsume.id };

      consumer.on('close', () => {
        router.appData.consumers.delete(consumer.id);
        socket.appData.consumers.delete(consumer.id);
      });
      
      consumer.on('producerclose', () => {
        console.log(`Consumer (id: ${consumer.id}) closed due to producer close`);
        consumer.close();
        socket.emit('producer-closed', { producerId: consumer.appData.producerId });
      });

      callback({
        producerId: producerToConsume.id,
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
    } catch (e) {
      console.error('Error in consumeStream', e);
      callback({ error: e.message });
    }
  });
  
  socket.on('resumeConsumer', async ({ consumerId }, callback) => {
    // ... (โค้ดส่วนนี้ถูกต้อง ไม่ต้องแก้ไข) ...
    const consumer = router.appData.consumers.get(consumerId);
    if (!consumer) {
      return callback({ error: 'Consumer not found' });
    }
    await consumer.resume();
    callback();
  });
});