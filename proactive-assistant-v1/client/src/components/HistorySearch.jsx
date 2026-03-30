import { useState, useMemo } from 'react';
import './HistorySearch.css';

/**
 * Search and filter for brief history
 */
export function HistorySearch({ history, onSelectBrief }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProvider, setFilterProvider] = useState('all');

  const filteredHistory = useMemo(() => {
    return history.filter(brief => {
      // Search term filter
      const matchesSearch = !searchTerm || 
        brief.greeting?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        brief.items?.some(item => 
          item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      
      // Provider filter
      const matchesProvider = filterProvider === 'all' || 
        brief.provider === filterProvider;
      
      return matchesSearch && matchesProvider;
    });
  }, [history, searchTerm, filterProvider]);

  const providers = useMemo(() => {
    const unique = new Set(history.map(b => b.provider).filter(Boolean));
    return ['all', ...Array.from(unique)];
  }, [history]);

  return (
    <div className="history-search">
      <div className="search-controls">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search briefs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              className="search-clear"
              onClick={() => setSearchTerm('')}
            >
              ×
            </button>
          )}
        </div>
        
        <select 
          className="filter-select"
          value={filterProvider}
          onChange={(e) => setFilterProvider(e.target.value)}
        >
          <option value="all">All Providers</option>
          {providers.filter(p => p !== 'all').map(provider => (
            <option key={provider} value={provider}>
              {provider.charAt(0).toUpperCase() + provider.slice(1)}
            </option>
          ))}
        </select>
      </div>
      
      <div className="search-results-info">
        {filteredHistory.length === history.length ? (
          <span>Showing all {history.length} briefs</span>
        ) : (
          <span>Showing {filteredHistory.length} of {history.length} briefs</span>
        )}
      </div>
      
      <div className="filtered-history-list">
        {filteredHistory.map((brief, index) => (
          <HistoryListItem 
            key={brief._id || index} 
            brief={brief} 
            onClick={() => onSelectBrief?.(brief)}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

function HistoryListItem({ brief, onClick, index }) {
  const itemCount = brief.items?.length || brief.recommendations?.length || 0;
  const date = new Date(brief.date);
  
  return (
    <div 
      className="history-list-item animate-fade-in"
      onClick={onClick}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="history-item-header">
        <span className="history-item-date">
          {date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          })}
        </span>
        <span className="history-item-provider">{brief.provider}</span>
      </div>
      
      {brief.greeting && (
        <p className="history-item-greeting">{brief.greeting.slice(0, 100)}...</p>
      )}
      
      <div className="history-item-meta">
        <span>📝 {itemCount} items</span>
        <span>⏱ {((brief.generationTime || 0) / 1000).toFixed(1)}s</span>
        {brief.contextSummary?.filesAccessed > 0 && (
          <span>📁 {brief.contextSummary.filesAccessed} files</span>
        )}
      </div>
    </div>
  );
}

export default HistorySearch;
