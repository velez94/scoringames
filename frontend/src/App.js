import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import BackofficeLayout from './components/BackofficeLayout';
import AthleteProfile from './components/AthleteProfile';

// Development configuration - replace with actual values after AWS deployment
Amplify.configure({
  Auth: {
    region: 'us-east-1',
    userPoolId: 'us-east-1_XXXXXXXXX', // Replace after deployment
    userPoolWebClientId: 'XXXXXXXXXXXXXXXXXXXXXXXXXX', // Replace after deployment
  },
  API: {
    endpoints: [
      {
        name: 'CalisthenicsAPI',
        endpoint: 'https://api.example.com', // Replace after deployment
        region: 'us-east-1',
      },
    ],
  },
});

function App() {
  return (
    <div className="App">
      <div className="dev-notice">
        <p>🚧 Development Mode - AWS services not connected yet. Deploy infrastructure first.</p>
      </div>
      
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
      
      <style jsx>{`
        .dev-notice {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          color: #856404;
          padding: 10px;
          text-align: center;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}

export default App;
