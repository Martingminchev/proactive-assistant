import { useApiHealth } from './hooks/useApiHealth';
import Assistant from './components/Assistant';
import './App.css';

function App() {
  const { status, retry } = useApiHealth(30000);

  if (status === 'checking') {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Connecting to server...</p>
      </div>
    );
  }

  if (status === 'disconnected') {
    return (
      <div className="app-error">
        <h2>Unable to Connect</h2>
        <p>Cannot connect to the Proactive Assistant server.</p>
        <p>Make sure the server is running at <code>http://localhost:3001</code></p>
        <button onClick={retry}>Retry Connection</button>
      </div>
    );
  }

  return (
    <div className="app">
      <Assistant />
    </div>
  );
}

export default App;
