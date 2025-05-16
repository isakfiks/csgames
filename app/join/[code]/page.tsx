'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';

interface JoinResponse {
  lobbyId: string;
  lobbyName: string;
  lobbyUrl: string;
}

export default function JoinPage(params: { code: string }) {
  const { code } = params;
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lobbyData, setLobbyData] = useState<JoinResponse | null>(null);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const joinLobby = async () => {
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
        
        // Clear interval if component unmounts
        return () => clearInterval(timer);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setIsLoading(false);
      }
    };

    if (code) {
      joinLobby();
    }
  }, [code, router]);

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
        <div className="border-2 border-black rounded-lg p-6">
          <h2 className="text-3xl font-bold text-black mb-6">Join Game</h2>
          
          {isLoading && (
            <div className="flex flex-col items-center py-8">
              <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-lg">Verifying invitation code...</p>
            </div>
          )}
          
          {error && (
            <div className="bg-red-100 border-2 border-red-500 p-6 rounded-lg">
              <p className="text-red-700 font-bold mb-3 text-xl">Error</p>
              <p className="mb-6">{error}</p>
              <Link 
                href="/explore"
                className="inline-block bg-black text-white px-6 py-2 rounded-lg"
              >
                Return to Games
              </Link>
            </div>
          )}
          
          {!isLoading && !error && lobbyData && (
            <div className="py-6">
              <div className="bg-green-100 border-2 border-green-500 p-4 rounded-lg mb-6">
                <p className="text-green-700 text-xl font-bold mb-1">Success!</p>
                <p className="text-green-700">You&apos;re joining:</p>
              </div>
              
              <p className="text-2xl font-bold mb-8">{lobbyData.lobbyName}</p>
              
              <div className="mb-6">
                <p className="text-lg">Redirecting in {countdown} seconds...</p>
                <div className="h-3 bg-gray-200 rounded-full mt-3">
                  <div 
                    className="h-3 bg-black rounded-full transition-all duration-300"
                    style={{ width: `${(countdown / 3) * 100}%` }}
                  ></div>
                </div>
              </div>
              
              <button
                onClick={() => router.push(`/lobby/${lobbyData.lobbyId}`)}
                className="bg-black text-white px-6 py-3 rounded-lg text-lg"
              >
                Join Now
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}