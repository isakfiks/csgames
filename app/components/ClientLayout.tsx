// app/components/ClientLayout.tsx
'use client';

import { ReactNode } from 'react';
import { ChatProvider } from '../contexts/ChatContext';
import ChatWidget from './ChatWidget';

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <ChatProvider>
      {children}
      <ChatWidget />
    </ChatProvider>
  );
}