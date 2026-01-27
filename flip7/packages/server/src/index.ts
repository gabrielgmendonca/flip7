import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@flip7/shared';
import { RoomManager } from './room/RoomManager';
import { registerRoomHandlers } from './socket/handlers/roomHandlers';
import { registerGameHandlers } from './socket/handlers/gameHandlers';
import { registerConnectionHandlers } from './socket/handlers/connectionHandlers';

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
    methods: ['GET', 'POST'],
  },
});

const roomManager = new RoomManager();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  registerRoomHandlers(io, socket, roomManager);
  registerGameHandlers(io, socket, roomManager);
  registerConnectionHandlers(io, socket, roomManager);
});

httpServer.listen(PORT, () => {
  console.log(`Flip7 server running on port ${PORT}`);
});
