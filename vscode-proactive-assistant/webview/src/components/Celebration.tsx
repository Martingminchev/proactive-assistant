import React, { useEffect, useState } from 'react';
import type { CelebrationData } from '../types';
import { useReducedMotion } from '../hooks/useTheme';

interface CelebrationProps {
  data: CelebrationData;
  onClose: () => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
  rotation: number;
}

// Generate random confetti particles
const generateParticles = (count: number): Particle[] => {
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9', '#fd79a8', '#a29bfe'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    color: colors[Math.floor(Math.random() * colors.length)],
    delay: Math.random() * 0.5,
    duration: 0.8 + Math.random() * 0.7,
    size: 6 + Math.random() * 8,
    rotation: Math.random() * 360
  }));
};

// Celebration icon based on type
const CelebrationIcon: React.FC<{ type: CelebrationData['type'] }> = ({ type }) => {
  const icons: Record<typeof type, string> = {
    streak: '🔥',
    milestone: '🏆',
    achievement: '🎉'
  };
  return <span className="celebration-icon-large">{icons[type]}</span>;
};

export const Celebration: React.FC<CelebrationProps> = ({ data, onClose }) => {
  const reducedMotion = useReducedMotion();
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  // Animate in
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Generate particles
  useEffect(() => {
    if (!reducedMotion) {
      setParticles(generateParticles(30));
    }
  }, [reducedMotion]);

  // Auto-close after animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, 4500);

    return () => clearTimeout(timer);
  }, [onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div 
      className={`celebration-overlay ${isVisible ? 'visible' : ''}`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Celebration"
    >
      {/* Confetti particles */}
      {!reducedMotion && (
        <div className="confetti-container" aria-hidden="true">
          {particles.map((particle) => (
            <div
              key={particle.id}
              className="confetti-particle"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                backgroundColor: particle.color,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                animationDelay: `${particle.delay}s`,
                animationDuration: `${particle.duration}s`,
                transform: `rotate(${particle.rotation}deg)`
              }}
            />
          ))}
        </div>
      )}

      {/* Main celebration card */}
      <div 
        className="celebration-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          className="celebration-close"
          onClick={handleClose}
          aria-label="Close celebration"
        >
          ×
        </button>

        <div className="celebration-content">
          <CelebrationIcon type={data.type} />
          
          <h2 className="celebration-title">{data.title}</h2>
          <p className="celebration-message">{data.message}</p>

          {data.streakCount !== undefined && (
            <div className="streak-display">
              <span className="streak-flame" aria-hidden="true">🔥</span>
              <span className="streak-count">{data.streakCount}</span>
              <span className="streak-label">day streak!</span>
            </div>
          )}

          {data.milestone && (
            <div className="milestone-badge">
              <span className="milestone-icon" aria-hidden="true">⭐</span>
              <span className="milestone-text">{data.milestone}</span>
            </div>
          )}
        </div>

        {/* Decorative elements */}
        <div className="celebration-decoration left" aria-hidden="true">✨</div>
        <div className="celebration-decoration right" aria-hidden="true">✨</div>
      </div>
    </div>
  );
};

export default Celebration;
