// app/chat/client/Chat.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';

// Define types based on the Database type
type Message = Database['public']['Tables']['messages']['Row'];
type NewMessage = Database['public']['Tables']['messages']['Insert'];

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isSupabaseReady, setIsSupabaseReady] = useState<boolean>(false);

  // Check if supabase is initialized
  useEffect(() => {
    if (supabase) {
      setIsSupabaseReady(true);
    } else {
      console.error('Supabase client is not initialized properly');
    }
  }, []);

  // Get the current user from Supabase auth
  useEffect(() => {
    if (!isSupabaseReady || !supabase) return;
    
    const getUser = async () => {
      try {
        const { data: { session } } = await supabase!.auth.getSession();
        const currentUser = session?.user || null;
        
        if (currentUser) {
          setUserId(currentUser.id);
          // Set username from user email or user metadata
          const metadata = currentUser.user_metadata as { name?: string; full_name?: string; } | null;
          setUsername(metadata?.name || 
                     metadata?.full_name || 
                     currentUser.email?.split('@')[0] || 
                     `User${Math.floor(Math.random() * 1000)}`);
        } else {
          // Generate anonymous user if not logged in
          setUserId(crypto.randomUUID());
          setUsername(`Guest${Math.floor(Math.random() * 1000)}`);
        }
      } catch (error) {
        console.error('Error getting user session:', error);
      }
    };

    getUser();

    // Listen for auth changes
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event: AuthChangeEvent, session: Session | null) => {
          const currentUser = session?.user || null;
          
          if (currentUser) {
            setUserId(currentUser.id);
            const metadata = currentUser.user_metadata as { name?: string; full_name?: string; } | null;
            setUsername(metadata?.name || 
                       metadata?.full_name || 
                       currentUser.email?.split('@')[0] || 
                       `User${Math.floor(Math.random() * 1000)}`);
          }
        }
      );

      return () => subscription?.unsubscribe();
    }
  }, [isSupabaseReady]);

  // Subscribe to new messages
  useEffect(() => {
    if (!isSupabaseReady || !supabase) return;
    
    // Fetch existing messages
    fetchMessages();
    
    // Subscribe to new messages - this is line 85 that has the error
    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages' }, 
        (payload: { new: Message }) => {
          setMessages(prevMessages => [...prevMessages, payload.new]);
        }
      )
      .subscribe();
    
    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [userId, isSupabaseReady]); // Re-subscribe when userId changes or when supabase is ready

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    if (!supabase) return;
    
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);
      
      if (error) {
        console.error('Error fetching messages:', error);
      } else {
        setMessages(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !supabase) return;

    const message: NewMessage = {
      user_id: userId,
      username: username,
      message: newMessage,
      room_id: 'general', // Default room
    };

    try {
      // Insert the message into Supabase
      const { error } = await supabase
        .from('messages')
        .insert([message]);

      if (error) {
        console.error('Error sending message:', error);
      } else {
        setNewMessage('');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Add a loading state for when Supabase isn't ready yet
  if (!isSupabaseReady) {
    return (
      <div className="flex justify-center items-center h-full">
        <p>Connecting to chat service...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-md mx-auto">
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 rounded-lg mb-4 min-h-[300px]">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`mb-3 p-3 rounded-lg ${
                msg.user_id === userId 
                  ? 'bg-blue-500 text-white ml-auto' 
                  : 'bg-white border border-gray-200'
              } max-w-[75%]`}
            >
              <div className="flex justify-between mb-1">
                <span className="font-medium">{msg.username}</span>
                <span className="text-xs opacity-70">
                  {formatTime(msg.created_at)}
                </span>
              </div>
              <p>{msg.message}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 p-2 border border-gray-300 rounded-md"
        />
        <button 
          type="submit" 
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          disabled={!newMessage.trim() || !supabase}
        >
          Send
        </button>
      </form>
    </div>
  );
}