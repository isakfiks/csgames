import { useState, useEffect, useRef } from 'react';

interface MiniGameProps {
  onClose: () => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  speedX: number;
  speedY: number;
  opacity: number;
}

const LobbyMiniGame: React.FC<MiniGameProps> = ({ onClose }) => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameActive, setGameActive] = useState(true);
  const [targetPosition, setTargetPosition] = useState({ x: 50, y: 50 });
  const [targetSize, setTargetSize] = useState(40);
  const [combo, setCombo] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showComboText, setShowComboText] = useState(false);
  const [comboText, setComboText] = useState('');
  const [comboPosition, setComboPosition] = useState({ x: 0, y: 0 });
  const [highScore, setHighScore] = useState(0);
  const [clickCooldown, setClickCooldown] = useState(false);
  
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const particleIdRef = useRef(0);
  const moveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Load high score from localStorage
  useEffect(() => {
    const savedHighScore = localStorage.getItem('minigame_highscore');
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore, 10));
    }
  }, []);
  
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
      moveTarget();
    }, 1200);
    
    // Decrease target size gradually
    const targetShrinker = setInterval(() => {
      if (gameActive) {
        setTargetSize((prev) => Math.max(20, prev - 1)); // Minimum size 20px
      }
    }, 3000);
    
    // Update particles
    const particleUpdater = setInterval(() => {
      setParticles(prevParticles => 
        prevParticles
          .map(p => ({
            ...p,
            x: p.x + p.speedX,
            y: p.y + p.speedY,
            opacity: p.opacity - 0.05,
            size: p.size * 0.95
          }))
          .filter(p => p.opacity > 0)
      );
    }, 50);
    
    return () => {
      clearInterval(timer);
      clearInterval(targetMover);
      clearInterval(targetShrinker);
      clearInterval(particleUpdater);
    };
  }, [gameActive]);
  
  const moveTarget = () => {
    if (gameAreaRef.current && gameActive) {
      const maxWidth = gameAreaRef.current.clientWidth - targetSize;
      const maxHeight = gameAreaRef.current.clientHeight - targetSize;
      
      setTargetPosition({
        x: Math.floor(Math.random() * maxWidth),
        y: Math.floor(Math.random() * maxHeight),
      });
    }
  };
  
  const createParticles = (x: number, y: number) => {
    const newParticles: Particle[] = [];
    const colors = ['#FF5252', '#FFD740', '#64FFDA', '#448AFF', '#E040FB'];
    
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 2;
      
      newParticles.push({
        id: particleIdRef.current++,
        x,
        y,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedX: Math.cos(angle) * speed,
        speedY: Math.sin(angle) * speed,
        opacity: 1
      });
    }
    
    setParticles(prev => [...prev, ...newParticles]);
  };
  
  const handleTargetClick = () => {
    if (gameActive && !clickCooldown) {
      // Set cooldown to prevent rapid clicks
      setClickCooldown(true);
      
      // Clear any pending move timeout
      if (moveTimeoutRef.current) {
        clearTimeout(moveTimeoutRef.current);
        moveTimeoutRef.current = null;
      }
      
      // Calculate score based on target size
      const points = Math.max(1, Math.floor(40 / targetSize));
      
      // Update score
      setScore(prevScore => prevScore + points);
      
      // Update combo
      const newCombo = combo + 1;
      setCombo(newCombo);
      
      // Show combo text
      if (newCombo >= 3) {
        let comboMessage;
        if (newCombo >= 10) comboMessage = 'GODLIKE!';
        else if (newCombo >= 8) comboMessage = 'UNSTOPPABLE!';
        else if (newCombo >= 6) comboMessage = 'DOMINATING!';
        else if (newCombo >= 4) comboMessage = 'IMPRESSIVE!';
        else comboMessage = 'COMBO x' + newCombo;
        
        setComboText(comboMessage);
        setComboPosition({ 
          x: targetPosition.x + targetSize/2, 
          y: targetPosition.y - 20 
        });
        setShowComboText(true);
        
        // Hide combo text after a delay
        setTimeout(() => setShowComboText(false), 800);
      }
      
      // Create particles
      createParticles(targetPosition.x + targetSize/2, targetPosition.y + targetSize/2);
      
      // Increase target size on hit but no larger than 40px
      setTargetSize(prev => Math.min(40, prev + 2));
      
      // Move the target after a short delay
      moveTimeoutRef.current = setTimeout(() => {
        moveTarget();
        moveTimeoutRef.current = null;
      }, 100);
      
      // Reset cooldown after a short delay
      setTimeout(() => {
        setClickCooldown(false);
      }, 150);
    }
  };
  
  const resetGame = () => {
    // Save high score
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('minigame_highscore', score.toString());
    }
    
    setScore(0);
    setTimeLeft(30);
    setGameActive(true);
    setTargetSize(40);
    setCombo(0);
    setParticles([]);
    setClickCooldown(false);
    
    // Clear any pending move timeout
    if (moveTimeoutRef.current) {
      clearTimeout(moveTimeoutRef.current);
      moveTimeoutRef.current = null;
    }
  };
  
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.innerHTML = styles;
    document.head.appendChild(styleEl);
    
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);
  
  return (
    <div className="border-2 border-black rounded-lg p-4 bg-white shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">Target Blitz</h3>
        <button 
          onClick={onClose}
          className="text-sm px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 transition-all"
        >
          Close
        </button>
      </div>
      
      <div className="flex justify-between mb-4">
        <div className="text-black">
          <strong>Score:</strong> <span className="text-lg">{score}</span>
          <div className="text-xs text-gray-500">High Score: {highScore}</div>
        </div>
        <div className={`text-black font-bold ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : ''}`}>
          <strong>Time:</strong> {timeLeft}s
        </div>
        {combo >= 3 && (
          <div className="text-indigo-600 font-bold">
            <strong>Combo:</strong> x{combo}
          </div>
        )}
      </div>
      
      <div 
        ref={gameAreaRef}
        className="relative bg-gradient-to-br from-gray-100 to-gray-200 w-full h-60 border rounded-lg overflow-hidden"
      >
        {/* Particles */}
        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute rounded-full"
            style={{
              left: particle.x,
              top: particle.y,
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.color,
              opacity: particle.opacity,
              transform: 'translate(-50%, -50%)'
            }}
          />
        ))}
        
        {/* Combo text */}
        {showComboText && (
          <div 
            className="absolute text-yellow-500 font-bold animate-float text-lg"
            style={{
              left: comboPosition.x,
              top: comboPosition.y,
              transform: 'translate(-50%, -50%)',
              textShadow: '0px 0px 8px rgba(0,0,0,0.5)'
            }}
          >
            {comboText}
          </div>
        )}
        
        {gameActive ? (
          <button
            className={`absolute rounded-full focus:outline-none transition-all duration-200 hover:scale-110 shadow-lg ${clickCooldown ? 'pointer-events-none opacity-80' : ''}`}
            style={{ 
              left: `${targetPosition.x}px`, 
              top: `${targetPosition.y}px`,
              width: `${targetSize}px`,
              height: `${targetSize}px`,
              background: 'radial-gradient(circle, #ff4d4d 0%, #cc0000 100%)',
              animation: 'pulse 1.5s infinite'
            }}
            onClick={handleTargetClick}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm transition-all duration-500">
            <div className="bg-white p-6 rounded-lg text-center shadow-xl transform animate-bounce-in">
              <h4 className="text-xl font-bold mb-2">Game Over!</h4>
              <p className="mb-2">Your final score: <span className="text-2xl font-bold">{score}</span></p>
              {score > highScore && (
                <p className="text-green-500 font-bold mb-4">New High Score!</p>
              )}
              <button 
                className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-all hover:scale-105 transform"
                onClick={resetGame}
              >
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>
      
      <p className="text-sm text-gray-500 mt-3">
        Click the target to score points! Smaller targets are worth more. Build combos for bonus points!
      </p>
    </div>
  );
};

// Add these styles to your global CSS or create a style tag
const styles = `
@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

@keyframes float {
  0% { transform: translate(-50%, -50%); opacity: 1; }
  100% { transform: translate(-50%, -100%); opacity: 0; }
}

@keyframes bounce-in {
  0% { transform: scale(0.3); opacity: 0; }
  50% { transform: scale(1.05); opacity: 1; }
  70% { transform: scale(0.9); }
  100% { transform: scale(1); }
}

.animate-pulse {
  animation: pulse 1.5s infinite;
}

.animate-float {
  animation: float 0.8s forwards;
}

.animate-bounce-in {
  animation: bounce-in 0.5s;
}
`;

export default LobbyMiniGame;
