import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import './AssistantChat.css';

const API_BASE = 'http://localhost:3001/api';

function AssistantChat({ context, onClose }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch existing conversation for this item if it exists
  useEffect(() => {
    if (context?.itemId) {
      fetchExistingConversation();
    }
  }, [context?.itemId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const fetchExistingConversation = async () => {
    try {
      const response = await fetch(`${API_BASE}/chat/item/${encodeURIComponent(context.itemId)}`);
      const data = await response.json();
      
      if (data.exists && data.conversation) {
        setConversationId(data.conversation._id);
        setMessages(data.conversation.messages || []);
      }
    } catch (error) {
      console.error('Error fetching conversation:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    
    // Add user message to UI immediately
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage, 
      timestamp: new Date().toISOString() 
    }]);
    
    setIsLoading(true);

    try {
      const endpoint = context?.itemId 
        ? `${API_BASE}/chat/contextual`
        : `${API_BASE}/chat`;

      const body = context?.itemId
        ? {
            message: userMessage,
            itemId: context.itemId,
            itemTitle: context.itemTitle,
            itemCategory: context.itemCategory,
            itemDescription: context.itemDescription
          }
        : {
            message: userMessage,
            conversationId
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      // Add assistant response
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString()
      }]);

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestedQuestions = context?.itemId ? [
    `Tell me more about ${context.itemTitle}`,
    'How do I get started with this?',
    'What are the alternatives?',
    'Why is this relevant to my goals?'
  ] : [
    'What should I focus on today?',
    'Summarize my recent activity',
    'Give me a productivity tip',
    'What tools would help me?'
  ];

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-title-section">
          {context?.itemId ? (
            <>
              <span className="chat-context-label">Chatting about:</span>
              <h3 className="chat-title">{context.itemTitle}</h3>
              {context.itemCategory && (
                <span className="chat-category">{context.itemCategory}</span>
              )}
            </>
          ) : (
            <h3 className="chat-title">Chat with Assistant</h3>
          )}
        </div>
        <button className="chat-close-btn" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p className="chat-empty-title">
              {context?.itemId 
                ? `Ask me anything about "${context.itemTitle}"`
                : 'How can I help you today?'}
            </p>
            <div className="suggested-questions">
              {suggestedQuestions.map((q, i) => (
                <button 
                  key={i}
                  className="suggested-question"
                  onClick={() => {
                    setInputValue(q);
                    inputRef.current?.focus();
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`chat-message ${msg.role} ${msg.isError ? 'error' : ''}`}
              >
                <div className="message-avatar">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-content">
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                  <span className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="chat-message assistant loading">
                <div className="message-avatar">🤖</div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="chat-input-section">
        <textarea
          ref={inputRef}
          className="chat-input"
          placeholder={context?.itemId 
            ? `Ask about ${context.itemTitle}...`
            : 'Type your message...'}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          rows={1}
          disabled={isLoading}
        />
        <button 
          className="chat-send-btn"
          onClick={sendMessage}
          disabled={!inputValue.trim() || isLoading}
        >
          {isLoading ? '...' : '→'}
        </button>
      </div>
    </div>
  );
}

export default AssistantChat;
