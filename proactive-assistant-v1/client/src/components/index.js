/**
 * Components index
 * Export all new user-friendly components
 */

export { default as ActionCenter } from './ActionCenter';
export { default as CurrentFocus } from './CurrentFocus';
export { default as InsightsPanel } from './InsightsPanel';
export { default as DataQualityIndicator } from './DataQualityIndicator';
export { default as SmartBrief } from './SmartBrief';
export { 
  NotificationPanel, 
  NotificationToast,
  NotificationToastContainer 
} from './NotificationPanel';

// Re-export existing components
export { default as Assistant } from './Assistant';
export { default as Dashboard } from './Dashboard';
export { default as ProactiveFeed } from './ProactiveFeed';
export { default as GoalsPanel } from './GoalsPanel';
export { default as Settings } from './Settings';
export { default as AssistantChat } from './AssistantChat';
export { default as FeedbackButtons } from './FeedbackButtons';
export { default as ItemActions } from './ItemActions';
export { default as SuggestionCard } from './SuggestionCard';
export { default as SuggestionPanel } from './SuggestionPanel';
export { default as HistorySearch } from './HistorySearch';
export { PageSkeleton, HistoryItemSkeleton } from './Skeleton';
