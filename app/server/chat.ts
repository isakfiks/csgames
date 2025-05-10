import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

// Create an Express application
const app = express();
app.use(cors());

// Create HTTP server and Socket.IO instance
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // In production, specify your client's URL
    methods: ["GET", "POST"]
  }
});

// Store connected users
interface ChatUser {
  id: string;
  username: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}

const users: ChatUser[] = [];
const messages: ChatMessage[] = [];

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  // Handle user joining
  socket.on('join_chat', (username: string) => {
    const user: ChatUser = {
      id: socket.id,
      username
    };
    users.push(user);
    
    // Send existing messages to new user
    socket.emit('receive_messages', messages);
    
    // Broadcast user joined message
    const joinMessage: ChatMessage = {
      id: Date.now().toString(),
      userId: 'system',
      username: 'System',
      text: `${username} has joined the chat`,
      timestamp: Date.now()
    };
    messages.push(joinMessage);
    io.emit('receive_message', joinMessage);
    
    // Send updated user list to all clients
    io.emit('users_update', users);
  });
  
  // Handle new messages
  socket.on('send_message', (messageData: { text: string }) => {
    const user = users.find(u => u.id === socket.id);
    if (user) {
      const message: ChatMessage = {
        id: Date.now().toString(),
        userId: socket.id,
        username: user.username,
        text: messageData.text,
        timestamp: Date.now()
      };
      messages.push(message);
      io.emit('receive_message', message);
    }
  });
  
  // Handle disconnections
  socket.on('disconnect', () => {
    const userIndex = users.findIndex(u => u.id === socket.id);
    if (userIndex !== -1) {
      const user = users[userIndex];
      users.splice(userIndex, 1);
      
      // Broadcast user left message
      const leaveMessage: ChatMessage = {
        id: Date.now().toString(),
        userId: 'system',
        username: 'System',
        text: `${user.username} has left the chat`,
        timestamp: Date.now()
      };
      messages.push(leaveMessage);
      io.emit('receive_message', leaveMessage);
      
      // Send updated user list to all clients
      io.emit('users_update', users);
    }
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Chat server running on port: ${PORT}`);
});

export default server;