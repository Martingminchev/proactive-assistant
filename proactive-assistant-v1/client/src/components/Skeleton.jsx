import './Skeleton.css';

// Base Skeleton component
function Skeleton({ width, height, variant = 'rect', className = '' }) {
  const style = {
    width: width || '100%',
    height: height || '1rem'
  };
  
  return (
    <div 
      className={`skeleton skeleton-${variant} ${className}`}
      style={style}
    />
  );
}

// Skeleton for a single brief card
export function BriefCardSkeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card-header">
        <Skeleton width="80px" height="22px" variant="pill" />
        <Skeleton width="60px" height="18px" variant="pill" />
      </div>
      <Skeleton width="85%" height="1.25rem" className="skeleton-title" />
      <Skeleton width="100%" height="0.9rem" className="skeleton-line" />
      <Skeleton width="100%" height="0.9rem" className="skeleton-line" />
      <Skeleton width="70%" height="0.9rem" className="skeleton-line" />
      <div className="skeleton-card-footer">
        <Skeleton width="100px" height="32px" variant="button" />
        <div className="skeleton-feedback">
          <Skeleton width="28px" height="28px" variant="circle" />
          <Skeleton width="28px" height="28px" variant="circle" />
        </div>
      </div>
    </div>
  );
}

// Skeleton for the greeting section
export function GreetingSkeleton() {
  return (
    <div className="skeleton-greeting">
      <Skeleton width="60%" height="2rem" className="skeleton-greeting-title" />
      <Skeleton width="100%" height="1rem" className="skeleton-line" />
      <Skeleton width="85%" height="1rem" className="skeleton-line" />
      <div className="skeleton-stats">
        <Skeleton width="80px" height="26px" variant="pill" />
        <Skeleton width="90px" height="26px" variant="pill" />
        <Skeleton width="100px" height="26px" variant="pill" />
      </div>
      <div className="skeleton-tip">
        <Skeleton width="24px" height="24px" variant="circle" />
        <Skeleton width="80%" height="1rem" />
      </div>
    </div>
  );
}

// Skeleton for the feed grid
export function FeedSkeleton({ count = 4 }) {
  return (
    <div className="skeleton-feed">
      <div className="skeleton-feed-grid">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={`animate-fade-in stagger-${Math.min(i + 1, 5)}`}>
            <BriefCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}

// Skeleton for history items
export function HistoryItemSkeleton({ index = 0 }) {
  return (
    <div className={`skeleton-history-item animate-fade-in stagger-${Math.min(index + 1, 5)}`}>
      <div className="skeleton-history-header">
        <Skeleton width="200px" height="1.25rem" />
        <Skeleton width="60px" height="20px" variant="pill" />
      </div>
      <Skeleton width="90%" height="0.9rem" className="skeleton-line" />
      <div className="skeleton-history-meta">
        <Skeleton width="70px" height="18px" />
        <Skeleton width="50px" height="18px" />
        <Skeleton width="60px" height="18px" />
      </div>
    </div>
  );
}

// Full page loading skeleton
export function PageSkeleton() {
  return (
    <div className="skeleton-page">
      <GreetingSkeleton />
      <FeedSkeleton count={4} />
    </div>
  );
}

export default Skeleton;
