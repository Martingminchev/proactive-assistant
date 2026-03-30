import React, { useEffect, useState } from 'react';

interface CelebrationProps {
  type: 'streak' | 'milestone' | 'achievement';
  message: string;
  onComplete: () => void;
  duration?: number; // in milliseconds
}

const celebrationConfig = {
  streak: {
    icon: '🔥',
    title: 'Streak!',
    color: '#ff6b35',
    particleCount: 30,
  },
  milestone: {
    icon: '🏆',
    title: 'Milestone Reached!',
    color: '#ffd700',
    particleCount: 50,
  },
  achievement: {
    icon: '⭐',
    title: 'Achievement Unlocked!',
    color: '#9b59b6',
    particleCount: 40,
  },
};

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
}

export const Celebration: React.FC<CelebrationProps> = ({
  type,
  message,
  onComplete,
  duration = 4000,
}) => {
  const config = celebrationConfig[type];
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  // Generate particles
  useEffect(() => {
    const colors = [config.color, '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'];
    const newParticles: Particle[] = [];

    for (let i = 0; i < config.particleCount; i++) {
      const angle = (Math.PI * 2 * i) / config.particleCount + (Math.random() - 0.5) * 0.5;
      const velocity = 5 + Math.random() * 10;
      
      newParticles.push({
        id: i,
        x: 50, // Center percentage
        y: 50,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 5, // Slight upward bias
        size: 4 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 20,
      });
    }

    setParticles(newParticles);
  }, [config.color, config.particleCount]);

  // Animate particles
  useEffect(() => {
    if (particles.length === 0) return;

    const interval = setInterval(() => {
      setParticles(prev =>
        prev.map(p => ({
          ...p,
          x: p.x + p.vx * 0.5,
          y: p.y + p.vy * 0.5,
          vy: p.vy + 0.3, // Gravity
          rotation: p.rotation + p.rotationSpeed,
        })).filter(p => p.y < 120) // Remove off-screen particles
      );
    }, 16);

    return () => clearInterval(interval);
  }, [particles.length]);

  // Auto-dismiss
  useEffect(() => {
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, duration - 500);

    const completeTimer = setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, duration);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [duration, onComplete]);

  if (!isVisible) return null;

  return (
    <div 
      className={`celebration-overlay ${isExiting ? 'exiting' : ''}`}
      role="alert"
      aria-live="polite"
    >
      {/* Particles */}
      <div className="particles-container" aria-hidden="true">
        {particles.map(particle => (
          <div
            key={particle.id}
            className="particle"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              backgroundColor: particle.color,
              transform: `rotate(${particle.rotation}deg)`,
            }}
          />
        ))}
      </div>

      {/* Celebration Content */}
      <div className="celebration-content">
        <div 
          className="celebration-icon"
          style={{ color: config.color }}
        >
          {config.icon}
        </div>
        <h2 className="celebration-title">{config.title}</h2>
        <p className="celebration-message">{message}</p>
      </div>

      {/* Progress bar */}
      <div className="celebration-progress" aria-hidden="true">
        <div 
          className="celebration-progress-bar"
          style={{ 
            animationDuration: `${duration}ms`,
            backgroundColor: config.color,
          }}
        />
      </div>
    </div>
  );
};

export default Celebration;
