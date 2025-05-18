'use client';

import type React from 'react';

import { useState, useEffect, useRef } from 'react';
import { FaComments, FaTimes, FaSmile } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { useChat } from '../contexts/ChatContext';
import EmojiPicker from 'emoji-picker-react';
import { motion, AnimatePresence } from 'framer-motion';

// Define types based on the Database type
type Message = Database['public']['Tables']['messages']['Row'];
type NewMessage = Database['public']['Tables']['messages']['Insert'];

export default function ChatWidget() {
  const { isChatVisible, toggleChat, hideChat } = useChat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [username, setUsername] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Check if Supabase is initialized
  useEffect(() => {
    if (supabase) {
      setIsSupabaseReady(true);
    } else {
      console.error('Supabase client is not initialized properly');
    }
  }, []);

  // Handle clicks outside to close the chat and emoji picker
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (chatRef.current && !chatRef.current.contains(event.target as Node) && isChatVisible) {
        hideChat();
      }

      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node) && showEmojiPicker) {
        setShowEmojiPicker(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isChatVisible, hideChat, showEmojiPicker]);

  // Get the current user from Supabase auth
  useEffect(() => {
    if (!isSupabaseReady || !supabase) return;

    const getUser = async () => {
      try {
        const {
          data: { session },
        } = await supabase!.auth.getSession();
        const currentUser = session?.user || null;

        if (currentUser) {
          setUserId(currentUser.id);
          // Set username from user email or user metadata
          const metadata = currentUser.user_metadata as { name?: string; full_name?: string } | null;
          setUsername(
            metadata?.name ||
              metadata?.full_name ||
              currentUser.email?.split('@')[0] ||
              `User${Math.floor(Math.random() * 1000)}`,
          );
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
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
        const currentUser = session?.user || null;

        if (currentUser) {
          setUserId(currentUser.id);
          const metadata = currentUser.user_metadata as { name?: string; full_name?: string } | null;
          setUsername(
            metadata?.name ||
              metadata?.full_name ||
              currentUser.email?.split('@')[0] ||
              `User${Math.floor(Math.random() * 1000)}`,
          );
        }
      });

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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: { new: Message }) => {
        setMessages((prevMessages) => [...prevMessages, payload.new]);
      })
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

  // Set up automatic message deletion after 24 hours
  useEffect(() => {
    if (!isSupabaseReady || !supabase) return;

    // Function to delete old messages
    const deleteOldMessages = async () => {
      try {
        // Calculate timestamp for 24 hours ago
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        const { error } = await supabase!.from('messages').delete().lt('created_at', twentyFourHoursAgo.toISOString());

        if (error) {
          console.error('Error deleting old messages:', error);
        } else {
          console.log('Successfully deleted messages older than 24 hours');
          // Refresh messages if chat is visible
          if (isChatVisible) {
            fetchMessages();
          }
        }
      } catch (error) {
        console.error('Failed to delete old messages:', error);
      }
    };

    // Run once when component mounts
    deleteOldMessages();

    // Set up interval to check and delete old messages every hour
    const interval = setInterval(deleteOldMessages, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isSupabaseReady, isChatVisible]);

  const fetchMessages = async () => {
    if (!supabase) return;

    try {
      // Calculate timestamp for 24 hours ago
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .gte('created_at', twentyFourHoursAgo.toISOString())
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
      const { error } = await supabase.from('messages').insert([message]);

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
      minute: '2-digit',
    });
  };

  const handleEmojiClick = (emojiData: { emoji: string }) => {
    setNewMessage((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const toggleEmojiPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowEmojiPicker((prev) => !prev);
  };

  // Using Geist font classes for consistency with your layout
  return (
    <div className='fixed bottom-4 right-4 z-50 font-[family-name:var(--font-geist-sans)] overflow-visible' ref={chatRef}>
      {/* Chat icon button */}
      <motion.button
        onClick={toggleChat}
        className='bg-gray-500 hover:bg-gray-600 text-white rounded-full p-3 shadow-lg flex items-center justify-center'
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label={isChatVisible ? 'Close chat' : 'Open chat'}
      >
        {isChatVisible ? <FaTimes size={24} /> : <FaComments size={24} />}
      </motion.button>

      {/* Chat window */}
      <AnimatePresence>
        {isChatVisible && (
          <motion.div
            className='absolute bottom-16 right-0 w-80 md:w-96 bg-white rounded-lg shadow-xl flex flex-col overflow-hidden'
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Chat header */}
            <div className='bg-slate-600 text-white px-4 py-3 flex justify-between items-center'>
              <motion.h3
                className='font-medium'
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                Game Chat
              </motion.h3>
              <motion.button
                onClick={hideChat}
                className='text-white hover:text-gray-200'
                whileHover={{ rotate: 90 }}
                transition={{ duration: 0.2 }}
                aria-label='Close chat'
              >
                <FaTimes size={16} />
              </motion.button>
            </div>

            {/* Chat messages */}
            <div className='flex-1 overflow-y-auto p-4 max-h-96 bg-gradient-to-b from-slate-50 to-white'>
              {!isSupabaseReady ? (
                <motion.div
                  className='text-center text-gray-400 my-4'
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className='flex justify-center items-center space-x-2'>
                    <div
                      className='w-2 h-2 bg-slate-400 rounded-full animate-bounce'
                      style={{ animationDelay: '0ms' }}
                    ></div>
                    <div
                      className='w-2 h-2 bg-slate-400 rounded-full animate-bounce'
                      style={{ animationDelay: '150ms' }}
                    ></div>
                    <div
                      className='w-2 h-2 bg-slate-400 rounded-full animate-bounce'
                      style={{ animationDelay: '300ms' }}
                    ></div>
                  </div>
                  <p className='mt-2'>Connecting to chat service...</p>
                </motion.div>
              ) : messages.length === 0 ? (
                <motion.div
                  className='text-center text-gray-400 my-4'
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  No messages yet. Start the conversation!
                </motion.div>
              ) : (
                messages.map((msg, index) => (
                  <motion.div
                    key={msg.id}
                    className={`mb-3 p-3 rounded-lg ${
                      msg.user_id === userId ? 'bg-slate-500 text-white ml-auto' : 'bg-slate-200'
                    } max-w-[80%] ${msg.user_id === userId ? 'ml-auto' : 'mr-auto'}`}
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      delay: Math.min(0.1 * index, 0.5),
                      type: 'spring',
                      damping: 25,
                      stiffness: 300,
                    }}
                  >
                    <div className='flex justify-between mb-1 text-xs'>
                      <span className={`font-bold ${msg.user_id === userId ? 'text-slate-100' : 'text-slate-700'}`}>
                        {msg.username}
                      </span>
                      <span className={`opacity-70 ${msg.user_id === userId ? 'text-slate-200' : 'text-slate-500'}`}>
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                    <p className={`text-sm ${msg.user_id === userId ? 'text-white' : 'text-slate-700'}`}>
                      {msg.message}
                    </p>
                  </motion.div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <motion.form
              onSubmit={handleSubmit}
              className='border-t border-gray-200 p-3 flex gap-2 bg-white'
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className='flex-1 relative'>
                <input
                  type='text'
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder='Type a message...'
                  className='w-full p-2 pr-10 border border-gray-300 rounded-md text-black focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition-all'
                />
                <motion.button
                  type='button'
                  onClick={toggleEmojiPicker}
                  className='absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700'
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <FaSmile size={18} />
                </motion.button>

                {/* Emoji Picker */}
                <AnimatePresence>
                  {showEmojiPicker && (
                    <motion.div
                      className='absolute bottom-12 right-0 z-50 max-h-64 overflow-y-auto bg-white rounded-lg shadow-lg'
                      ref={emojiPickerRef}
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    >
                      <EmojiPicker onEmojiClick={handleEmojiClick} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <motion.button
                type='submit'
                className='px-3 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 text-sm transition-colors'
                disabled={!newMessage.trim() || !supabase}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Send
              </motion.button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}