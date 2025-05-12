// app/components/ChatWidget.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { FaComments, FaTimes } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { useChat } from '../contexts/ChatContext';

// Define types based on the Database type
type Message = Database['public']['Tables']['messages']['Row'];
type NewMessage = Database['public']['Tables']['messages']['Insert'];

export default function ChatWidget() {
  const { isChatVisible, toggleChat, hideChat } = useChat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  const [username, setUsername] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // Check if Supabase is initialized
  useEffect(() => {
    if (supabase) {
      setIsSupabaseReady(true);
    } else {
      console.error('Supabase client is not initialized properly');
    }
  }, []);

  // Handle clicks outside to close the chat
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (chatRef.current && !chatRef.current.contains(event.target as Node) && isChatVisible) {
        hideChat();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isChatVisible, hideChat]);

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
          setUsername(`Anonymous${Math.floor(Math.random() * 1000)}`);
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

  // Subscribe to new messages when chat is open
  useEffect(() => {
    if (!isSupabaseReady || !supabase || !isChatVisible) return;
    
    // Fetch existing messages
    fetchMessages();
    
    // Subscribe to new messages
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
  }, [isChatVisible, isSupabaseReady]);

  // Scroll to bottom when messages change or when chat opens
  useEffect(() => {
    if (isChatVisible) {
      scrollToBottom();
    }
  }, [messages, isChatVisible]);

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

  // Using Geist font classes for consistency with your layout
  return (
    <div className="fixed bottom-4 right-4 z-50 font-[family-name:var(--font-geist-sans)]" ref={chatRef}>
      {/* Chat icon button */}
      <button
        onClick={toggleChat}
        className="bg-gray-500 hover:bg-gray-600 text-white rounded-full p-3 shadow-lg flex items-center justify-center transition-all"
        aria-label={isChatVisible ? "Close chat" : "Open chat"}
      >
        {isChatVisible ? <FaTimes size={24} /> : <FaComments size={24} />}
      </button>

      {/* Chat window */}
      {isChatVisible && (
        <div className="absolute bottom-16 right-0 w-80 md:w-96 bg-white rounded-lg shadow-xl flex flex-col overflow-hidden transition-all transform origin-bottom-right">
          {/* Chat header */}
          <div className="bg-slate-600 text-white px-4 py-3 flex justify-between items-center">
            <h3 className="font-medium">Game Chat</h3>
            <button 
              onClick={hideChat}
              className="text-white hover:text-gray-200"
              aria-label="Close chat"
            >
              <FaTimes size={16} />
            </button>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-4 max-h-96">
            {!isSupabaseReady ? (
              <div className="text-center text-gray-400 my-4">
                Connecting to chat service...
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-gray-400 my-4">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`mb-3 p-3 rounded-lg ${
                    msg.user_id === userId 
                      ? 'bg-gray-100 text-white ml-auto' 
                      : 'bg-slate-300'
                  } max-w-[80%] ${msg.user_id === userId ? 'ml-auto' : 'mr-auto'}`}
                >
                  <div className="flex justify-between mb-1 text-xs">
                    <span className="text-black font-bold">{msg.username}</span>
                    <span className="text-black opacity-70">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                  <p className="text-slate-600 text-sm">{msg.message}</p>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          <form onSubmit={handleSubmit} className="border-t border-gray-200 p-3 flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 p-2 border border-gray-300 rounded-md text-black"
            />
            <button 
              type="submit" 
              className="px-3 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-600 text-sm"
              disabled={!newMessage.trim() || !supabase}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}