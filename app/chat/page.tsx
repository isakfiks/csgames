// chat/page.tsx
import Chat from './client/Chat';

export default function ChatPage() {
  return (
    <div className="container mx-auto p-4 h-screen flex flex-col">
      <h1 className="text-2xl font-bold mb-4">Game Chat</h1>
      <div className="flex-1">
        <Chat />
      </div>
    </div>
  );
}