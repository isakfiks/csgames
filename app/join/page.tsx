'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';
import { motion } from 'framer-motion';

interface JoinResponse {
  lobbyId: string;
  lobbyName: string;
  lobbyUrl: string;
}

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lobbyData, setLobbyData] = useState<JoinResponse | null>(null);
  const [countdown, setCountdown] = useState(3);
  
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };
  
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    // Only allow characters A-Z and numbers 0-9, maximum 6 characters
    const filteredValue = value.replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(filteredValue);
  };

  const joinLobby = async () => {
    if (!code || code.length < 4) {
      setError('Please enter a valid join code (at least 4 characters)');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/join-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join lobby');
      }

      const data = await response.json();
      setLobbyData(data);
      
      // Start countdown for redirect
      let count = 3;
      setCountdown(count);
      const timer = setInterval(() => {
        count -= 1;
        setCountdown(count);
        if (count <= 0) {
          clearInterval(timer);
          router.push(`/lobby/${data.lobbyId}`);
        }
      }, 1000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white min-h-screen p-8 font-[family-name:var(--font-geist-sans)]">
      <header className="max-w-4xl mx-auto mb-8">
        <div className="flex justify-between items-center">
          <Link href="/explore" className="flex items-center text-black">
            <FaArrowLeft className="mr-2" />
            <span>Back to Games</span>
          </Link>
          <div className="flex">
            <h1 className="text-2xl font-bold text-black">CSGames</h1>
            <span className="text-black text-2xl">.dev</span>
          </div>
        </div>
      </header>

      <main className="text-black max-w-4xl mx-auto">
        <motion.div 
          className="border-2 border-black rounded-lg p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold text-black mb-6">Join Game</h2>
          
          {!lobbyData && !isLoading && (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="py-6"
            >
              <motion.div variants={itemVariants} className="mb-6">
                <label htmlFor="joinCode" className="block text-lg font-medium mb-2">
                  Enter Join Code
                </label>
                <div className="flex">
                  <motion.input
                    id="joinCode"
                    type="text"
                    value={code}
                    onChange={handleCodeChange}
                    placeholder="Enter code (e.g., AB12C3)"
                    className="flex-1 text-xl border-2 border-black rounded-l-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black"
                    whileFocus={{ scale: 1.01 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  />
                  <motion.button
                    onClick={joinLobby}
                    className="bg-black text-white px-6 py-3 rounded-r-lg text-lg"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Join
                  </motion.button>
                </div>
                <p className="mt-2 text-sm text-gray-600">Enter the 4-6 character code from your invite</p>
              </motion.div>

              {error && (
                <motion.div 
                  className="bg-red-100 border-2 border-red-500 p-4 rounded-lg"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-red-700">{error}</p>
                </motion.div>
              )}
            </motion.div>
          )}
          
          {isLoading && (
            <motion.div 
              className="flex flex-col items-center py-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div 
                className="w-12 h-12 border-4 border-black border-t-transparent rounded-full mb-4"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              ></motion.div>
              <p className="text-lg">Verifying invitation code...</p>
            </motion.div>
          )}
          
          {!isLoading && !error && lobbyData && (
            <motion.div 
              className="py-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div 
                className="bg-green-100 border-2 border-green-500 p-4 rounded-lg mb-6"
                initial={{ x: -20 }}
                animate={{ x: 0 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <p className="text-green-700 text-xl font-bold mb-1">Success!</p>
                <p className="text-green-700">You&apos;re joining:</p>
              </motion.div>
              
              <motion.p 
                className="text-2xl font-bold mb-8"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {lobbyData.lobbyName}
              </motion.p>
              
              <div className="mb-6">
                <p className="text-lg">Redirecting in {countdown} seconds...</p>
                <div className="h-3 bg-gray-200 rounded-full mt-3">
                  <motion.div 
                    className="h-3 bg-black rounded-full"
                    initial={{ width: "100%" }}
                    animate={{ width: `${(countdown / 3) * 100}%` }}
                    transition={{ duration: 1, ease: "linear" }}
                  ></motion.div>
                </div>
              </div>
              
              <motion.button
                onClick={() => router.push(`/lobby/${lobbyData.lobbyId}`)}
                className="bg-black text-white px-6 py-3 rounded-lg text-lg"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Join Now
              </motion.button>
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  );
}