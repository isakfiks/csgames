import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}

interface ChatUser {
  id: string;
  username: string;
}

const Chat: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [username, setUsername] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Connect to socket server
  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Handle receiving messages
    socket.on('receive_message', (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    // Handle receiving all messages on join
    socket.on('receive_messages', (allMessages: ChatMessage[]) => {
      setMessages(allMessages);
    });

    // Handle users update
    socket.on('users_update', (updatedUsers: ChatUser[]) => {
      setUsers(updatedUsers);
    });

    return () => {
      socket.off('receive_message');
      socket.off('receive_messages');
      socket.off('users_update');
    };
  }, [socket]);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle joining the chat
  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && socket) {
      socket.emit('join_chat', username);
      setIsJoined(true);
    }
  };

  // Handle sending messages
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && socket) {
      socket.emit('send_message', { text: message });
      setMessage('');
    }
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Login screen
  if (!isJoined) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-800 text-white p-4">
        <div className="w-full max-w-md bg-gray-700 rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-6 text-center">Join Chat</h1>
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-1">
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 bg-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your username"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-200"
            >
              Join
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Chat interface
  return (
    <div className="flex h-screen bg-gray-800 text-white">
      {/* Users sidebar */}
      <div className="w-64 bg-gray-900 border-r border-gray-700 p-4">
        <h2 className="text-xl font-bold mb-4">Online Users</h2>
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>{user.username}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.userId === socket?.id ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs md:max-w-md rounded-lg px-4 py-2 ${
                    msg.userId === 'system'
                      ? 'bg-gray-600 text-gray-300'
                      : msg.userId === socket?.id
                      ? 'bg-blue-600'
                      : 'bg-gray-700'
                  }`}
                >
                  {msg.userId !== socket?.id && msg.userId !== 'system' && (
                    <div className="font-bold text-sm">{msg.username}</div>
                  )}
                  <p>{msg.text}</p>
                  <div className="text-xs text-gray-400 text-right mt-1">
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Message input */}
        <div className="border-t border-gray-700 p-4">
          <form onSubmit={handleSendMessage} className="flex space-x-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type a message..."
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-200"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;