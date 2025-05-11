// app/components/ChatButton.tsx
'use client';

import { useChat } from '../contexts/ChatContext';
import { FaComments } from 'react-icons/fa';

export default function ChatButton() {
  const { showChat } = useChat();
  
  return (
    <button 
      onClick={showChat}
      className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
    >
      <FaComments /> Chat
    </button>
  );
}