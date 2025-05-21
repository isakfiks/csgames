import { useState, useEffect, useRef } from 'react';

interface MiniGameProps {
  onClose: () => void;
}

const LobbyMiniGame: React.FC<MiniGameProps> = ({ onClose }) => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameActive, setGameActive] = useState(true);
  const [targetPosition, setTargetPosition] = useState({ x: 50, y: 50 });
  const gameAreaRef = useRef<HTMLDivElement>(null);
  
  // Initialize the game
  useEffect(() => {
    // Start the timer
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setGameActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Move the target every second
    const targetMover = setInterval(() => {
      if (gameAreaRef.current) {
        const maxWidth = gameAreaRef.current.clientWidth - 40;
        const maxHeight = gameAreaRef.current.clientHeight - 40;
        
        setTargetPosition({
          x: Math.floor(Math.random() * maxWidth),
          y: Math.floor(Math.random() * maxHeight),
        });
      }
    }, 1000);
    
    return () => {
      clearInterval(timer);
      clearInterval(targetMover);
    };
  }, []);
  
  const handleTargetClick = () => {
    if (gameActive) {
      setScore(score + 1);
      
      // Move the target immediately after click
      if (gameAreaRef.current) {
        const maxWidth = gameAreaRef.current.clientWidth - 40;
        const maxHeight = gameAreaRef.current.clientHeight - 40;
        
        setTargetPosition({
          x: Math.floor(Math.random() * maxWidth),
          y: Math.floor(Math.random() * maxHeight),
        });
      }
    }
  };
  
  const resetGame = () => {
    setScore(0);
    setTimeLeft(30);
    setGameActive(true);
  };
  
  return (
    <div className="border-2 border-black rounded-lg p-4 bg-white shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">Click the Target</h3>
        <button 
          onClick={onClose}
          className="text-sm px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
        >
          Close
        </button>
      </div>
      
      <div className="flex justify-between mb-4">
        <div className="text-black">
          <strong>Score:</strong> {score}
        </div>
        <div className="text-black">
          <strong>Time Left:</strong> {timeLeft}s
        </div>
      </div>
      
      <div 
        ref={gameAreaRef}
        className="relative bg-gray-100 w-full h-60 border rounded-lg overflow-hidden"
      >
        {gameActive ? (
          <button
            className="absolute w-10 h-10 bg-red-500 rounded-full focus:outline-none hover:bg-red-600 transition-colors"
            style={{ 
              left: `${targetPosition.x}px`, 
              top: `${targetPosition.y}px`,
              transform: 'translate(-50%, -50%)'
            }}
            onClick={handleTargetClick}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-30">
            <div className="bg-white p-4 rounded-lg text-center">
              <h4 className="text-lg font-bold mb-2">Game Over!</h4>
              <p className="mb-4">Your final score: {score}</p>
              <button 
                className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
                onClick={resetGame}
              >
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>
      
      <p className="text-sm text-gray-500 mt-3">
        Click on the red target as many times as you can before time runs out!
      </p>
    </div>
  );
};

export default LobbyMiniGame;
