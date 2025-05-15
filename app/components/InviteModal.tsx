'use client';

import { useState } from 'react';

interface InviteModalProps {
  lobbyId: string;
  onClose: () => void;
}

interface InviteResponse {
  code: string;
  fullUrl: string;
  lobbyUrl: string;
}

export default function InviteModal({ lobbyId, onClose }: InviteModalProps) {
  const [inviteCode, setInviteCode] = useState<InviteResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const generateCode = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lobbyId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate code');
      }

      const data = await response.json();
      setInviteCode(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'code' | 'url') => {
    navigator.clipboard.writeText(text);
    setCopyMessage(`${type === 'code' ? 'Code' : 'URL'} copied!`);
    setTimeout(() => setCopyMessage(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full border-2 border-black">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-black">Invite Players</h3>
          <button 
            className="text-gray-500 hover:text-black"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        
        {!inviteCode ? (
          <button
            onClick={generateCode}
            disabled={isLoading}
            className="bg-black text-white px-4 py-2 rounded-lg w-full"
          >
            {isLoading ? 'Generating...' : 'Generate Invite Code'}
          </button>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Invite Code:</p>
              <div className="flex items-center">
                <span className="font-mono bg-gray-100 px-3 py-2 rounded text-lg mr-2 flex-grow text-center text-black border border-gray-300">
                  {inviteCode.code}
                </span>
                <button
                  onClick={() => copyToClipboard(inviteCode.code, 'code')}
                  className="bg-black text-white px-3 py-2 rounded text-sm"
                >
                  Copy
                </button>
              </div>
            </div>
            
            <div>
              <p className="text-sm text-gray-600 mb-1">Share Link:</p>
              <div className="flex items-center">
                <span className="font-mono bg-gray-100 px-3 py-2 rounded text-sm mr-2 truncate flex-grow text-black border border-gray-300">
                  {inviteCode.fullUrl}
                </span>
                <button
                  onClick={() => copyToClipboard(inviteCode.fullUrl, 'url')}
                  className="bg-black text-white px-3 py-2 rounded text-sm whitespace-nowrap"
                >
                  Copy
                </button>
              </div>
            </div>
            
            {copyMessage && (
              <div className="bg-green-100 border border-green-400 text-green-700 p-2 rounded text-center text-sm">
                {copyMessage}
              </div>
            )}
            
            <button
              onClick={generateCode}
              className="text-sm text-blue-500 hover:text-blue-700 underline"
            >
              Generate New Code
            </button>
          </div>
        )}
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 p-2 rounded mt-2 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}