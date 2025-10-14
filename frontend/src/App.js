import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Amplify, Auth } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import BackofficeLayout from './components/BackofficeLayout';
import AthleteProfile from './components/AthleteProfile';

// Production configuration from CDK deployment
Amplify.configure({
  Auth: {
    region: 'us-east-2',
    userPoolId: 'us-east-2_byZ9cagQ0',
    userPoolWebClientId: '34e7c5rhk57sgab81pia0c87s6',
  },
  API: {
    endpoints: [
      {
        name: 'CalisthenicsAPI',
        endpoint: 'https://iokvgd6tm3.execute-api.us-east-2.amazonaws.com/prod',
        region: 'us-east-2',
        custom_header: async () => {
          try {
            const session = await Auth.currentSession();
            return { Authorization: `Bearer ${session.getIdToken().getJwtToken()}` };
          } catch (error) {
            console.warn('No auth session available:', error);
            return {};
          }
        }
      },
    ],
  },
});

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>Something went wrong.</h2>
          <button onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <div className="App">
        <Authenticator>
          {({ signOut, user }) => {
            const userRole = user?.attributes?.['custom:role'] || 'athlete';
            
            return (
              <Router>
                <Routes>
                  {userRole === 'organizer' ? (
                    <Route path="/*" element={<BackofficeLayout user={user} signOut={signOut} />} />
                  ) : (
                    <Route path="/*" element={<AthleteProfile user={user} signOut={signOut} />} />
                  )}
                </Routes>
              </Router>
            );
          }}
        </Authenticator>
      </div>
    </ErrorBoundary>
  );
}

export default App;
