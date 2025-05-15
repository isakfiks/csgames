'use client';

import { useState } from 'react';

interface InviteCodeGeneratorProps {
  lobbyId: string;
}

interface InviteResponse {
  code: string;
  fullUrl: string;
  lobbyUrl: string;
}

export default function InviteCodeGenerator({ lobbyId }: InviteCodeGeneratorProps) {
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
    <div>
      {!inviteCode ? (
        <button
          onClick={generateCode}
          disabled={isLoading}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md w-full"
        >
          {isLoading ? 'Generating...' : 'Generate Invite Code'}
        </button>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-400 mb-1">Invite Code:</p>
            <div className="flex items-center">
              <span className="font-mono bg-gray-700 px-3 py-2 rounded text-lg mr-2 flex-grow text-center">
                {inviteCode.code}
              </span>
              <button
                onClick={() => copyToClipboard(inviteCode.code, 'code')}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm"
              >
                Copy
              </button>
            </div>
          </div>
          
          <div>
            <p className="text-sm text-gray-400 mb-1">Share Link:</p>
            <div className="flex items-center">
              <span className="font-mono bg-gray-700 px-3 py-2 rounded text-sm mr-2 truncate flex-grow">
                {inviteCode.fullUrl}
              </span>
              <button
                onClick={() => copyToClipboard(inviteCode.fullUrl, 'url')}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm whitespace-nowrap"
              >
                Copy
              </button>
            </div>
          </div>
          
          {copyMessage && (
            <div className="bg-green-900/30 border border-green-700 text-green-400 p-2 rounded text-center text-sm">
              {copyMessage}
            </div>
          )}
          
          <button
            onClick={generateCode}
            className="text-sm text-blue-400 hover:text-blue-300 underline"
          >
            Generate New Code
          </button>
        </div>
      )}
      
      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-400 p-2 rounded mt-2 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}