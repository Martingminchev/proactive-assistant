import { useState } from 'react';
import './GoalsPanel.css';

const API_BASE = 'http://localhost:3001/api';

function GoalsPanel({ goals, onClose, onGoalAdded }) {
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalDescription, setNewGoalDescription] = useState('');
  const [newGoalPriority, setNewGoalPriority] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const handleAddGoal = async (e) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/preferences/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newGoalTitle.trim(),
          description: newGoalDescription.trim(),
          priority: newGoalPriority
        })
      });

      if (response.ok) {
        setNewGoalTitle('');
        setNewGoalDescription('');
        setNewGoalPriority(1);
        setIsAdding(false);
        onGoalAdded();
      }
    } catch (error) {
      console.error('Error adding goal:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteGoal = async (goalId) => {
    try {
      await fetch(`${API_BASE}/preferences/goals/${goalId}/complete`, {
        method: 'POST'
      });
      onGoalAdded();
    } catch (error) {
      console.error('Error completing goal:', error);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    try {
      await fetch(`${API_BASE}/preferences/goals/${goalId}`, {
        method: 'DELETE'
      });
      onGoalAdded();
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  const handleUpdatePriority = async (goalId, priority) => {
    try {
      await fetch(`${API_BASE}/preferences/goals/${goalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority })
      });
      onGoalAdded();
    } catch (error) {
      console.error('Error updating goal:', error);
    }
  };

  return (
    <div className="goals-panel-overlay" onClick={onClose}>
      <div className="goals-panel" onClick={(e) => e.stopPropagation()}>
        <div className="goals-header">
          <h2>Your Goals</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="goals-description">
          <p>Set your goals and the AI will tailor recommendations to help you achieve them.</p>
        </div>

        <div className="goals-list">
          {goals.length === 0 ? (
            <div className="no-goals">
              <p>No goals set yet. Add your first goal to get personalized recommendations!</p>
            </div>
          ) : (
            goals.map((goal) => (
              <div key={goal._id} className="goal-item">
                <div className="goal-main">
                  <div className="goal-checkbox" onClick={() => handleCompleteGoal(goal._id)}>
                    ○
                  </div>
                  <div className="goal-content">
                    <h4 className="goal-title">{goal.title}</h4>
                    {goal.description && (
                      <p className="goal-description">{goal.description}</p>
                    )}
                  </div>
                </div>
                <div className="goal-actions">
                  <select 
                    className="priority-select"
                    value={goal.priority}
                    onChange={(e) => handleUpdatePriority(goal._id, parseInt(e.target.value))}
                    title="Priority"
                  >
                    <option value={1}>P1 - Critical</option>
                    <option value={2}>P2 - High</option>
                    <option value={3}>P3 - Medium</option>
                    <option value={4}>P4 - Low</option>
                    <option value={5}>P5 - Nice to have</option>
                  </select>
                  <button 
                    className="delete-btn"
                    onClick={() => handleDeleteGoal(goal._id)}
                    title="Delete goal"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {isAdding ? (
          <form className="add-goal-form" onSubmit={handleAddGoal}>
            <input
              type="text"
              className="goal-input title"
              placeholder="What's your goal?"
              value={newGoalTitle}
              onChange={(e) => setNewGoalTitle(e.target.value)}
              autoFocus
              maxLength={200}
            />
            <textarea
              className="goal-input description"
              placeholder="Add more details (optional)"
              value={newGoalDescription}
              onChange={(e) => setNewGoalDescription(e.target.value)}
              rows={2}
              maxLength={1000}
            />
            <div className="form-row">
              <select 
                className="priority-select"
                value={newGoalPriority}
                onChange={(e) => setNewGoalPriority(parseInt(e.target.value))}
              >
                <option value={1}>P1 - Critical</option>
                <option value={2}>P2 - High</option>
                <option value={3}>P3 - Medium</option>
                <option value={4}>P4 - Low</option>
                <option value={5}>P5 - Nice to have</option>
              </select>
              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => setIsAdding(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="submit-btn"
                  disabled={!newGoalTitle.trim() || isSubmitting}
                >
                  {isSubmitting ? 'Adding...' : 'Add Goal'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <button 
            className="add-goal-btn"
            onClick={() => setIsAdding(true)}
          >
            + Add Goal
          </button>
        )}

        <div className="goals-tip">
          <span>💡</span>
          <p>Tip: Set 1-3 focused goals for best results. The AI uses these to prioritize your recommendations.</p>
        </div>
      </div>
    </div>
  );
}

export default GoalsPanel;
