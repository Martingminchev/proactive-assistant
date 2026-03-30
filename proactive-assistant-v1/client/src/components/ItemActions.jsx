import { useState, useCallback } from 'react';
import './ItemActions.css';

/**
 * Action buttons for feed items
 * - Copy: Copy description to clipboard
 * - Share: Share item (or copy link)
 * - Done: Mark as completed
 * - Save: Save for later
 */
export function ItemActions({ item, onChat, compact = false }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [done, setDone] = useState(false);

  const handleCopy = useCallback(async () => {
    const text = `${item.title}\n\n${item.description}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [item]);

  const handleShare = useCallback(async () => {
    const shareData = {
      title: item.title,
      text: item.description,
      url: item.url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled
      }
    } else {
      // Fallback: copy to clipboard
      handleCopy();
    }
  }, [item, handleCopy]);

  const handleSave = useCallback(() => {
    setSaved(!saved);
    // TODO: Persist to backend
  }, [saved]);

  const handleDone = useCallback(() => {
    setDone(!done);
    // TODO: Persist to backend
  }, [done]);

  if (compact) {
    return (
      <div className="item-actions compact">
        <ActionButton 
          icon={copied ? '✓' : '📋'} 
          onClick={handleCopy}
          active={copied}
          title="Copy to clipboard"
        />
        <ActionButton 
          icon="💬" 
          onClick={onChat}
          title="Ask about this"
        />
      </div>
    );
  }

  return (
    <div className="item-actions">
      <ActionButton 
        icon={copied ? '✓' : '📋'} 
        onClick={handleCopy}
        active={copied}
        title={copied ? 'Copied!' : 'Copy'}
        label={copied ? 'Copied' : 'Copy'}
      />
      <ActionButton 
        icon="↗️" 
        onClick={handleShare}
        title="Share"
        label="Share"
      />
      <ActionButton 
        icon={saved ? '🔖' : '🔖'} 
        onClick={handleSave}
        active={saved}
        title={saved ? 'Saved' : 'Save for later'}
        label={saved ? 'Saved' : 'Save'}
      />
      <ActionButton 
        icon={done ? '✅' : '☐'} 
        onClick={handleDone}
        active={done}
        title={done ? 'Completed' : 'Mark as done'}
        label={done ? 'Done' : 'Do it'}
      />
      <ActionButton 
        icon="💬" 
        onClick={onChat}
        title="Ask about this"
        label="Chat"
      />
    </div>
  );
}

function ActionButton({ icon, onClick, active, title, label }) {
  return (
    <button
      className={`action-icon-btn ${active ? 'active' : ''}`}
      onClick={onClick}
      title={title}
    >
      <span className="action-icon">{icon}</span>
      {label && <span className="action-label">{label}</span>}
    </button>
  );
}

export default ItemActions;
