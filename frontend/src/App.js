import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Amplify, Auth } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import BackofficeLayout from './components/BackofficeLayout';
import UserSetup from './components/UserSetup';

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
  const signUpFields = {
    signUp: {
      username: {
        order: 1,
        placeholder: 'Enter your email',
        isRequired: true,
        label: 'Email *'
      },
      given_name: {
        order: 2,
        placeholder: 'Enter your first name',
        isRequired: true,
        label: 'First Name *'
      },
      family_name: {
        order: 3,
        placeholder: 'Enter your last name',
        isRequired: true,
        label: 'Last Name *'
      },
      phone_number: {
        order: 4,
        placeholder: '+1234567890',
        isRequired: true,
        label: 'Phone Number *'
      },
      password: {
        order: 5,
        placeholder: 'Enter your password',
        isRequired: true,
        label: 'Password *'
      },
      confirm_password: {
        order: 6,
        placeholder: 'Confirm your password',
        isRequired: true,
        label: 'Confirm Password *'
      }
    }
  };

  return (
    <ErrorBoundary>
      <div className="App">
        <Authenticator formFields={signUpFields}>
          {({ signOut, user }) => {
            const userRole = user?.attributes?.['custom:role'] || 'athlete';
            
            return (
              <Router>
                <Routes>
                  {userRole === 'organizer' ? (
                    <Route path="/*" element={<BackofficeLayout user={user} signOut={signOut} />} />
                  ) : (
                    <Route path="/*" element={<UserSetup user={user} signOut={signOut} />} />
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
