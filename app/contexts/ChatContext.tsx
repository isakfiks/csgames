// app/contexts/ChatContext.tsx
'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface ChatContextType {
  isChatVisible: boolean;
  showChat: () => void;
  hideChat: () => void;
  toggleChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isChatVisible, setIsChatVisible] = useState(false);

  const showChat = () => setIsChatVisible(true);
  const hideChat = () => setIsChatVisible(false);
  const toggleChat = () => setIsChatVisible(prev => !prev);

  return (
    <ChatContext.Provider value={{ isChatVisible, showChat, hideChat, toggleChat }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}