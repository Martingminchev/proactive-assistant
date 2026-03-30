import { useState } from 'react';
import './FeedbackButtons.css';

function FeedbackButtons({ item, itemId, onFeedback, onChat, compact = false }) {
  const [feedback, setFeedback] = useState(null); // 'liked' | 'disliked' | null

  const handleLike = () => {
    const newFeedback = feedback === 'liked' ? null : 'liked';
    setFeedback(newFeedback);
    if (newFeedback && onFeedback) {
      onFeedback(itemId, item.title, item.category, item.format, true);
    }
  };

  const handleDislike = () => {
    const newFeedback = feedback === 'disliked' ? null : 'disliked';
    setFeedback(newFeedback);
    if (newFeedback && onFeedback) {
      onFeedback(itemId, item.title, item.category, item.format, false);
    }
  };

  const handleChat = () => {
    if (onChat) {
      onChat(item);
    }
  };

  if (compact) {
    return (
      <div className="feedback-buttons compact">
        <button 
          className={`feedback-btn chat-btn`}
          onClick={handleChat}
          title="Chat about this"
        >
          💬
        </button>
        <button 
          className={`feedback-btn like-btn ${feedback === 'liked' ? 'active' : ''}`}
          onClick={handleLike}
          title="Like - show me more like this"
        >
          👍
        </button>
        <button 
          className={`feedback-btn dislike-btn ${feedback === 'disliked' ? 'active' : ''}`}
          onClick={handleDislike}
          title="Dislike - show me less like this"
        >
          👎
        </button>
      </div>
    );
  }

  return (
    <div className="feedback-buttons">
      <button 
        className={`feedback-btn chat-btn`}
        onClick={handleChat}
        title="Chat about this"
      >
        <span className="btn-icon">💬</span>
        <span className="btn-label">Chat</span>
      </button>
      <div className="feedback-divider"></div>
      <button 
        className={`feedback-btn like-btn ${feedback === 'liked' ? 'active' : ''}`}
        onClick={handleLike}
        title="Like - show me more like this"
      >
        <span className="btn-icon">👍</span>
      </button>
      <button 
        className={`feedback-btn dislike-btn ${feedback === 'disliked' ? 'active' : ''}`}
        onClick={handleDislike}
        title="Dislike - show me less like this"
      >
        <span className="btn-icon">👎</span>
      </button>
    </div>
  );
}

export default FeedbackButtons;
