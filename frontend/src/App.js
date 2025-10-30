import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Amplify, Auth } from 'aws-amplify';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { OrganizationProvider } from './contexts/OrganizationContext';
import BackofficeLayout from './components/BackofficeLayout';
import UserSetup from './components/UserSetup';
import LandingPage from './components/LandingPage';
import PublicEvents from './components/PublicEvents';
import PublicEventDetail from './components/PublicEventDetail';
import { canAccessBackoffice } from './utils/organizerRoles';

// Configuration from environment variables
Amplify.configure({
  Auth: {
    region: process.env.REACT_APP_REGION,
    userPoolId: process.env.REACT_APP_USER_POOL_ID,
    userPoolWebClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID,
  },
  Storage: {
    AWSS3: {
      bucket: 'calisthenics-event-images-571340586587',
      region: process.env.REACT_APP_REGION,
    }
  },
  API: {
    endpoints: [
      {
        name: 'CalisthenicsAPI',
        endpoint: process.env.REACT_APP_API_URL,
        custom_header: async () => {
          try {
            const session = await Auth.currentSession();
            const token = session.getIdToken().getJwtToken();
            return { Authorization: token };
          } catch (error) {
            console.error('Auth error:', error);
            return {};
          }
        }
      }
    ]
  }
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

function AuthPage() {
  return (
    <Authenticator 
      initialState="signIn"
      loginMechanisms={['email']}
      signUpAttributes={['given_name', 'family_name', 'nickname']}
      formFields={{
        signUp: {
          given_name: {
            label: 'First Name',
            placeholder: 'Enter your first name',
            isRequired: true,
            order: 1
          },
          family_name: {
            label: 'Last Name',
            placeholder: 'Enter your last name',
            isRequired: true,
            order: 2
          },
          nickname: {
            label: 'Alias',
            placeholder: 'Enter your alias (e.g., pepito)',
            isRequired: false,
            order: 3
          },
          email: {
            label: 'Email',
            placeholder: 'Enter your email',
            isRequired: true,
            order: 4
          },
          password: {
            label: 'Password',
            placeholder: 'Enter your password',
            isRequired: true,
            order: 5
          },
          confirm_password: {
            label: 'Confirm Password',
            placeholder: 'Confirm your password',
            isRequired: true,
            order: 6
          }
        }
      }}
      components={{
        SignUp: {
          FormFields() {
            const { validationErrors } = useAuthenticator();
            return (
              <>
                <Authenticator.SignUp.FormFields />
                <div style={{ marginTop: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>
                    I am a
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '15px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}>
                      <input 
                        type="radio" 
                        name="custom:role" 
                        value="athlete"
                        defaultChecked
                        style={{ marginRight: '10px' }}
                      />
                      <div>
                        <div style={{ fontWeight: '600' }}>Athlete</div>
                        <div style={{ fontSize: '14px', color: '#718096' }}>Compete in events</div>
                      </div>
                    </label>
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '15px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}>
                      <input 
                        type="radio" 
                        name="custom:role" 
                        value="organizer"
                        style={{ marginRight: '10px' }}
                      />
                      <div>
                        <div style={{ fontWeight: '600' }}>Organizer</div>
                        <div style={{ fontSize: '14px', color: '#718096' }}>Create and manage competitions</div>
                      </div>
                    </label>
                  </div>
                </div>
              </>
            );
          }
        }
      }}
    >
      {({ signOut, user }) => {
        const isOrganizer = canAccessBackoffice(user);
        
        return (
          <Routes>
            {isOrganizer ? (
              <Route path="/*" element={
                <OrganizationProvider>
                  <BackofficeLayout user={user} signOut={signOut} />
                </OrganizationProvider>
              } />
            ) : (
              <Route path="/*" element={<UserSetup user={user} signOut={signOut} />} />
            )}
          </Routes>
        );
      }}
    </Authenticator>
  );
}

function AuthPageWrapper() {
  const navigate = useNavigate();
  const location = useLocation();
  
  React.useEffect(() => {
    // Check if user is already authenticated
    Auth.currentAuthenticatedUser()
      .then(user => {
        // User is authenticated, redirect away from login
        if (location.pathname === '/login') {
          const isOrganizer = canAccessBackoffice(user);
          if (isOrganizer) {
            navigate('/backoffice', { replace: true });
          } else {
            navigate(`/athlete/${user.username}`, { replace: true });
          }
        }
      })
      .catch(() => {
        // Not authenticated, stay on login page
      });
  }, [navigate, location]);
  
  return <AuthPage />;
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/events" element={<PublicEvents />} />
          <Route path="/events/:eventId" element={<PublicEventDetail />} />
          <Route path="/login" element={<AuthPageWrapper />} />
          <Route path="/athlete/events/:eventId" element={<AuthPage />} />
          <Route path="/athlete/:athleteId" element={<AuthPage />} />
          <Route path="/backoffice/*" element={<AuthPage />} />
          <Route path="/*" element={<AuthPage />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
