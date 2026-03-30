/**
 * Celebration - Micro-celebrations for achievements
 * Streak counter, achievement badges, subtle animations
 */

import { useEffect, useState, useCallback } from 'react';
import './Celebration.css';

/**
 * @typedef {Object} Achievement
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} icon
 * @property {boolean} [isNew]
 */

/**
 * @typedef {Object} CelebrationProps
 * @property {number} [streakDays] - Current streak in days
 * @property {number} [streakType] - Streak type: 0=none, 1=focus, 2=productivity, 3=tasks
 * @property {Achievement[]} [achievements] - List of achievements
 * @property {Achievement} [newAchievement] - Newly unlocked achievement to animate
 * @property {boolean} [showConfetti] - Trigger confetti animation
 * @property {string} [message] - Custom celebration message
 * @property {'compact' | 'full'} [variant] - Visual variant
 * @property {() => void} [onDismiss] - Dismiss handler
 */

/**
 * @param {CelebrationProps} props
 */
function Celebration({
  streakDays = 0,
  streakType = 0,
  achievements = [],
  newAchievement,
  showConfetti = false,
  message,
  variant = 'full',
  onDismiss
}) {
  const [particles, setParticles] = useState([]);
  const [showNewBadge, setShowNewBadge] = useState(false);

  // Generate confetti particles
  const createConfetti = useCallback(() => {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#EC4899'];
    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -10 - Math.random() * 20,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 6,
      rotation: Math.random() * 360,
      delay: Math.random() * 500,
      duration: 1000 + Math.random() * 1000
    }));
    setParticles(newParticles);

    // Clear particles after animation
    setTimeout(() => setParticles([]), 2500);
  }, []);

  // Trigger confetti effect
  useEffect(() => {
    if (showConfetti) {
      createConfetti();
    }
  }, [showConfetti, createConfetti]);

  // Show new achievement animation
  useEffect(() => {
    if (newAchievement) {
      setShowNewBadge(true);
      createConfetti();
      const timer = setTimeout(() => setShowNewBadge(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [newAchievement, createConfetti]);

  // Get streak icon and label
  const getStreakInfo = (type, days) => {
    const types = {
      1: { icon: '🎯', label: 'Focus', color: '#8B5CF6' },
      2: { icon: '⚡', label: 'Productive', color: '#10B981' },
      3: { icon: '✓', label: 'Tasks', color: '#3B82F6' },
      0: { icon: '🔥', label: 'Day', color: '#F59E0B' }
    };
    return types[type] || types[0];
  };

  const streakInfo = getStreakInfo(streakType, streakDays);

  // Compact variant - just streak badge
  if (variant === 'compact') {
    return (
      <div className="celebration celebration--compact">
        {streakDays > 0 && (
          <div 
            className="celebration__streak-mini"
            style={{ '--streak-color': streakInfo.color }}
          >
            <span className="celebration__streak-icon">{streakInfo.icon}</span>
            <span className="celebration__streak-count">{streakDays}</span>
          </div>
        )}
        {achievements.slice(0, 3).map(ach => (
          <span key={ach.id} className="celebration__badge-mini" title={ach.title}>
            {ach.icon}
          </span>
        ))}
      </div>
    );
  }

  // New achievement popup
  if (showNewBadge && newAchievement) {
    return (
      <div className="celebration celebration--popup">
        {/* Confetti particles */}
        {particles.map(p => (
          <div
            key={p.id}
            className="celebration__particle"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              transform: `rotate(${p.rotation}deg)`,
              animationDelay: `${p.delay}ms`,
              animationDuration: `${p.duration}ms`
            }}
          />
        ))}
        
        <div className="celebration__popup-content">
          <div className="celebration__badge-large">{newAchievement.icon}</div>
          <h3 className="celebration__popup-title">Achievement Unlocked!</h3>
          <p className="celebration__popup-name">{newAchievement.title}</p>
          <p className="celebration__popup-desc">{newAchievement.description}</p>
          <button className="celebration__popup-btn" onClick={onDismiss}>
            Awesome!
          </button>
        </div>
      </div>
    );
  }

  // Full celebration display
  return (
    <div className="celebration">
      {/* Confetti particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="celebration__particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg)`,
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.duration}ms`
          }}
        />
      ))}

      {/* Streak display */}
      {streakDays > 0 && (
        <div 
          className="celebration__streak"
          style={{ '--streak-color': streakInfo.color }}
        >
          <div className="celebration__streak-ring">
            <span className="celebration__streak-emoji">{streakInfo.icon}</span>
            <span className="celebration__streak-number">{streakDays}</span>
          </div>
          <div className="celebration__streak-info">
            <span className="celebration__streak-label">
              {streakDays} day{streakDays !== 1 ? 's' : ''} streak
            </span>
            <span className="celebration__streak-type">{streakInfo.label}</span>
          </div>
        </div>
      )}

      {/* Custom message */}
      {message && (
        <p className="celebration__message">{message}</p>
      )}

      {/* Achievements grid */}
      {achievements.length > 0 && (
        <div className="celebration__achievements">
          <h4 className="celebration__section-title">Achievements</h4>
          <div className="celebration__badges">
            {achievements.map((achievement) => (
              <div 
                key={achievement.id}
                className={`celebration__badge ${achievement.isNew ? 'is-new' : ''}`}
                title={achievement.description}
              >
                <span className="celebration__badge-icon">{achievement.icon}</span>
                <span className="celebration__badge-title">{achievement.title}</span>
                {achievement.isNew && <span className="celebration__badge-new">NEW</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Hook for managing celebration triggers
 */
export function useCelebration() {
  const [state, setState] = useState({
    show: false,
    achievement: null,
    confetti: false
  });

  const trigger = useCallback((achievement, options = {}) => {
    setState({
      show: true,
      achievement,
      confetti: options.confetti ?? true
    });
  }, []);

  const dismiss = useCallback(() => {
    setState(prev => ({ ...prev, show: false }));
  }, []);

  return { ...state, trigger, dismiss };
}

export default Celebration;
