'use client';

import { useState } from 'react';

interface GenerateCodeButtonProps {
  lobbyId: string;
}

interface InviteResponse {
  code: string;
  fullUrl: string;
  lobbyUrl: string;
}

export default function GenerateCodeButton({ lobbyId }: GenerateCodeButtonProps) {
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

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopyMessage(`${type} copied to clipboard!`);
    setTimeout(() => setCopyMessage(null), 2000);
  };

  return (
    <div>
      {!inviteCode ? (
        <button
          onClick={generateCode}
          disabled={isLoading}
          className="bg-black text-white px-4 py-2 rounded-lg"
        >
          {isLoading ? 'Generating...' : 'Generate Invite Code'}
        </button>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="font-bold mb-1">Invite Code:</p>
            <div className="flex items-center bg-gray-100 rounded-lg overflow-hidden">
              <span className="font-mono px-3 py-2 text-lg flex-grow">
                {inviteCode.code}
              </span>
              <button
                onClick={() => copyToClipboard(inviteCode.code, 'Code')}
                className="bg-black text-white px-3 py-2 text-sm"
              >
                Copy
              </button>
            </div>
          </div>
          
          <div>
            <p className="font-bold mb-1">Share Link:</p>
            <div className="flex items-center bg-gray-100 rounded-lg overflow-hidden">
              <span className="font-mono px-3 py-2 text-sm truncate">
                {inviteCode.fullUrl}
              </span>
              <button
                onClick={() => copyToClipboard(inviteCode.fullUrl, 'URL')}
                className="bg-black text-white px-3 py-2 text-sm"
              >
                Copy
              </button>
            </div>
          </div>
          
          {copyMessage && (
            <div className="bg-green-100 border border-green-500 text-green-700 p-2 rounded text-sm">
              {copyMessage}
            </div>
          )}
          
          <button
            onClick={generateCode}
            className="text-sm text-black underline"
          >
            Generate New Code
          </button>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-500 text-red-700 p-2 rounded mt-2 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}