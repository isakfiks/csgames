'use client';

import type React from 'react';

import { useState, useEffect, useRef } from 'react';
import { FaComments, FaTimes, FaSmile, FaHeart, FaThumbsUp, FaLaugh, FaFire } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { useChat } from '../contexts/ChatContext';
import EmojiPicker from 'emoji-picker-react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

// Define types based on the Database type
type Message = Database['public']['Tables']['messages']['Row'] & {
  reactions?: Record<string, number>;
};
type NewMessage = Database['public']['Tables']['messages']['Insert'];

// Animation presets for messages
const messageAnimations = [
  { type: 'spring', damping: 25, stiffness: 300 },
  { type: 'spring', damping: 15, stiffness: 200 },
  { type: 'spring', damping: 10, stiffness: 150 },
];

// Reaction options
const REACTIONS = [
  { emoji: '❤️', icon: <FaHeart className="text-red-500" />, name: 'heart' },
  { emoji: '👍', icon: <FaThumbsUp className="text-blue-500" />, name: 'thumbsUp' },
  { emoji: '😂', icon: <FaLaugh className="text-yellow-500" />, name: 'laugh' },
  { emoji: '🔥', icon: <FaFire className="text-orange-500" />, name: 'fire' },
];

export default function ChatWidget() {
  const { isChatVisible, toggleChat, hideChat } = useChat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [triggerWord, setTriggerWord] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, Record<string, number>>>({});
  const [showReactionMenu, setShowReactionMenu] = useState<string | null>(null);
  const [chatTheme, setChatTheme] = useState<'light' | 'dark' | 'funky'>('light');
  const [userColor, setUserColor] = useState('');

  const [username, setUsername] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const reactionMenuRef = useRef<HTMLDivElement>(null);

  const { width, height } = useWindowSize();

  // Predefined trigger words that cause effects
  const triggerWords = {
    confetti: ['congrats', 'congratulations', 'amazing', 'hooray', 'yay', 'awesome'],
    highlight: ['important', 'attention', 'notice', 'alert', 'warning'],
    rainbow: ['rainbow', 'colorful', 'colors', 'pride'],
    shake: ['wow', 'omg', 'shocked', 'woah', 'what'],
  };

  // Check if Supabase is initialized
  useEffect(() => {
    if (supabase) {
      setIsSupabaseReady(true);
    } else {
      console.error('Supabase client is not initialized properly');
    }
    
    // Assign random user color for message styling
    const colors = ['#FF5252', '#FF9800', '#FFEB3B', '#4CAF50', '#2196F3', '#9C27B0', '#607D8B'];
    setUserColor(colors[Math.floor(Math.random() * colors.length)]);
  }, []);

  // Handle clicks outside to close menus
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (chatRef.current && !chatRef.current.contains(event.target as Node) && isChatVisible) {
        hideChat();
      }

      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node) && showEmojiPicker) {
        setShowEmojiPicker(false);
      }

      if (reactionMenuRef.current && !reactionMenuRef.current.contains(event.target as Node) && showReactionMenu) {
        setShowReactionMenu(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isChatVisible, hideChat, showEmojiPicker, showReactionMenu]);

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
        
        // Check for trigger words
        const msgText = payload.new.message.toLowerCase();
        for (const [effect, words] of Object.entries(triggerWords)) {
          if (words.some(word => msgText.includes(word))) {
            if (effect === 'confetti') {
              setShowConfetti(true);
              setTriggerWord(words.find(word => msgText.includes(word)) || '');
              setTimeout(() => setShowConfetti(false), 5000);
            }
            break;
          }
        }
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

    // Check for special commands
    if (newMessage.startsWith('/theme ')) {
      const themeArg = newMessage.split(' ')[1];
      if (['light', 'dark', 'funky'].includes(themeArg)) {
        setChatTheme(themeArg as 'light' | 'dark' | 'funky');
        setNewMessage('');
        return;
      }
    }

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
        
        // Check for trigger words
        const msgText = newMessage.toLowerCase();
        for (const [effect, words] of Object.entries(triggerWords)) {
          if (words.some(word => msgText.includes(word))) {
            if (effect === 'confetti') {
              setShowConfetti(true);
              setTriggerWord(words.find(word => msgText.includes(word)) || '');
              setTimeout(() => setShowConfetti(false), 5000);
            }
            break;
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Update typing status for realistic chat experience
    if (!isTyping) {
      setIsTyping(true);
      // Would normally send typing status to server here
    }
    
    // Clear previous timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    // Set new timeout
    const timeout = setTimeout(() => {
      setIsTyping(false);
      // Would normally send stopped typing status to server
    }, 1000);
    
    setTypingTimeout(timeout);
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

  const toggleReactionMenu = (messageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowReactionMenu(prev => prev === messageId ? null : messageId);
  };

  const addReaction = (messageId: string, reactionName: string) => {
    setMessageReactions(prev => {
      const messageReactions = prev[messageId] || {};
      const currentCount = messageReactions[reactionName] || 0;
      
      return {
        ...prev,
        [messageId]: {
          ...messageReactions,
          [reactionName]: currentCount + 1
        }
      };
    });
    
    setShowReactionMenu(null);
  };

  const getChatThemeClasses = () => {
    switch(chatTheme) {
      case 'dark':
        return 'bg-gray-800 text-white';
      case 'funky':
        return 'bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white';
      default:
        return 'bg-white text-black';
    }
  };

  const getMessageThemeClasses = (isOwn: boolean) => {
    if (chatTheme === 'dark') {
      return isOwn ? 'bg-blue-700 text-white' : 'bg-gray-700 text-white';
    } else if (chatTheme === 'funky') {
      return isOwn 
        ? 'bg-gradient-to-r from-green-400 to-blue-500 text-white' 
        : 'bg-gradient-to-r from-purple-400 to-pink-500 text-white';
    }
    return isOwn ? 'bg-slate-500 text-white' : 'bg-slate-200 text-black';
  };

  // Check for special message animations
  const getMessageAnimation = (message: string) => {
    const lowerMsg = message.toLowerCase();
    
    if (triggerWords.shake.some(word => lowerMsg.includes(word))) {
      return {
        initial: { x: 0 },
        animate: { 
          x: [0, -10, 10, -10, 10, 0],
          transition: { duration: 0.5 } 
        }
      };
    }
    
    if (triggerWords.highlight.some(word => lowerMsg.includes(word))) {
      return {
        initial: { scale: 1 },
        animate: { 
          scale: [1, 1.05, 1],
          boxShadow: ["0 0 0 rgba(255,255,0,0)", "0 0 15px rgba(255,255,0,0.7)", "0 0 0 rgba(255,255,0,0)"],
          transition: { duration: 1.5, repeat: 1, repeatDelay: 1 } 
        }
      };
    }
    
    if (triggerWords.rainbow.some(word => lowerMsg.includes(word))) {
      return {
        initial: { background: "linear-gradient(90deg, #ff0000, #ff9900)" },
        animate: { 
          background: [
            "linear-gradient(90deg, #ff0000, #ff9900)",
            "linear-gradient(90deg, #ff9900, #33cc33)",
            "linear-gradient(90deg, #33cc33, #3399ff)",
            "linear-gradient(90deg, #3399ff, #cc33cc)",
            "linear-gradient(90deg, #cc33cc, #ff0000)",
          ],
          transition: { duration: 2, repeat: Infinity } 
        }
      };
    }
    
    return {};
  };

  // Using Geist font classes for consistency with your layout
  return (
    <div className='fixed bottom-4 right-4 z-50 font-[family-name:var(--font-geist-sans)] overflow-visible' ref={chatRef}>
      {/* Confetti effect */}
      {showConfetti && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.15}
        />
      )}
      
      {/* Chat icon button */}
      <motion.button
        onClick={toggleChat}
        className='bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-full p-3 shadow-lg flex items-center justify-center'
        whileHover={{ scale: 1.1, rotate: [0, -5, 5, -5, 5, 0] }}
        whileTap={{ scale: 0.95 }}
        aria-label={isChatVisible ? 'Close chat' : 'Open chat'}
      >
        {isChatVisible ? <FaTimes size={24} /> : <FaComments size={24} />}
      </motion.button>

      {/* Chat window */}
      <AnimatePresence>
        {isChatVisible && (
          <motion.div
            className={`absolute bottom-16 right-0 w-80 md:w-96 rounded-lg shadow-xl flex flex-col overflow-hidden ${getChatThemeClasses()}`}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Chat header */}
            <div className={`${chatTheme === 'light' ? 'bg-slate-600' : chatTheme === 'dark' ? 'bg-gray-900' : 'bg-gradient-to-r from-indigo-600 to-violet-600'} text-white px-4 py-3 flex justify-between items-center`}>
              <motion.h3
                className='font-medium flex items-center'
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <span className="mr-2">💬</span>
                Game Chat
                {showConfetti && <span className="ml-2">🎉</span>}
              </motion.h3>
              <div className="flex space-x-2">
                <motion.button
                  onClick={() => setChatTheme(prev => prev === 'light' ? 'dark' : prev === 'dark' ? 'funky' : 'light')}
                  className='text-white hover:text-gray-200 px-2 py-1 rounded-md text-xs'
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {chatTheme === 'light' ? '🌙' : chatTheme === 'dark' ? '🌈' : '☀️'}
                </motion.button>
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
            </div>

            {/* Chat messages */}
            <div className={`flex-1 overflow-y-auto p-4 max-h-96 ${chatTheme === 'light' ? 'bg-gradient-to-b from-slate-50 to-white' : chatTheme === 'dark' ? 'bg-gray-800' : 'bg-gradient-to-b from-fuchsia-900/30 to-purple-900/30'}`}>
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
                messages.map((msg, index) => {
                  const isOwnMessage = msg.user_id === userId;
                  const messageAnimation = getMessageAnimation(msg.message);
                  const reactions = messageReactions[msg.id as string] || {};
                  
                  return (
                    <motion.div
                      key={msg.id}
                      className={`mb-3 p-3 rounded-lg ${getMessageThemeClasses(isOwnMessage)} max-w-[80%] ${isOwnMessage ? 'ml-auto' : 'mr-auto'} relative`}
                      initial={{ opacity: 0, y: 20, scale: 0.9, ...messageAnimation.initial }}
                      animate={{ 
                        opacity: 1, 
                        y: 0, 
                        scale: 1,
                        ...messageAnimation.animate
                      }}
                      transition={messageAnimations[index % messageAnimations.length]}
                      onDoubleClick={(e) => toggleReactionMenu(msg.id as string, e)}
                    >
                      <div className='flex justify-between mb-1 text-xs'>
                        <span className={`font-bold ${isOwnMessage ? 'text-slate-100' : chatTheme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}
                             style={isOwnMessage ? {} : { color: userColor }}>
                          {msg.username}
                        </span>
                        <span className={`opacity-70 ${isOwnMessage ? 'text-slate-200' : chatTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                      <p className={`text-sm ${isOwnMessage ? 'text-white' : chatTheme === 'dark' ? 'text-white' : 'text-slate-700'}`}>
                        {msg.message}
                      </p>
                      
                      {/* Reaction display */}
                      {Object.keys(reactions).length > 0 && (
                        <div className="flex mt-1 space-x-1">
                          {Object.entries(reactions).map(([reaction, count]) => (
                            <div key={reaction} className="bg-white/30 rounded-full px-2 py-0.5 text-xs flex items-center">
                              <span className="mr-1">{REACTIONS.find(r => r.name === reaction)?.emoji}</span>
                              <span>{count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Reaction menu */}
                      <AnimatePresence>
                        {showReactionMenu === msg.id && (
                          <motion.div 
                            className="absolute -top-10 right-0 bg-white shadow-lg rounded-full p-1 flex space-x-1 z-10"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            ref={reactionMenuRef}
                          >
                            {REACTIONS.map(reaction => (
                              <motion.button
                                key={reaction.name}
                                className="hover:bg-gray-100 p-1.5 rounded-full"
                                whileHover={{ scale: 1.2 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => addReaction(msg.id as string, reaction.name)}
                              >
                                {reaction.emoji}
                              </motion.button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <motion.form
              onSubmit={handleSubmit}
              className={`border-t ${chatTheme === 'light' ? 'border-gray-200' : chatTheme === 'dark' ? 'border-gray-700' : 'border-purple-700'} p-3 flex gap-2 ${chatTheme === 'light' ? 'bg-white' : chatTheme === 'dark' ? 'bg-gray-800' : 'bg-gradient-to-r from-purple-900/50 to-fuchsia-900/50'}`}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className='flex-1 relative'>
                <input
                  type='text'
                  value={newMessage}
                  onChange={handleTyping}
                  placeholder='Type a message... (try "wow!" or "rainbow")'
                  className={`w-full p-2 pr-10 border ${chatTheme === 'dark' ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-black'} rounded-md focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition-all`}
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
                className={`px-3 py-2 ${chatTheme === 'light' ? 'bg-slate-600 hover:bg-slate-700' : chatTheme === 'dark' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600'} text-white rounded-md text-sm transition-colors`}
                disabled={!newMessage.trim() || !supabase}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Send
              </motion.button>
            </motion.form>
            
            {/* Help text for special commands */}
            <div className={`px-3 py-1 text-xs ${chatTheme === 'light' ? 'bg-gray-100 text-gray-600' : chatTheme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-purple-900/30 text-purple-200'}`}>
              Try typing special words like "wow", "rainbow", "important", or use /theme light|dark|funky
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}