import React, { useState } from 'react';
import { Auth } from 'aws-amplify';

function CustomSignUp({ onSuccess, onSwitchToSignIn }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    given_name: '',
    family_name: '',
    phone_number: '',
    role: 'athlete'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate required fields
    if (!formData.given_name || !formData.family_name) {
      setError('First name and last name are required');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate phone number format
    if (formData.phone_number && !formData.phone_number.startsWith('+')) {
      setError('Phone number must start with + and country code (e.g., +1234567890)');
      return;
    }

    setLoading(true);

    try {
      const signUpParams = {
        username: formData.email,
        password: formData.password,
        attributes: {
          email: formData.email,
          given_name: formData.given_name,
          family_name: formData.family_name,
          'custom:role': formData.role
        }
      };

      // Add phone number only if provided
      if (formData.phone_number) {
        signUpParams.attributes.phone_number = formData.phone_number;
      }

      await Auth.signUp(signUpParams);

      alert('Account created! Please check your email to verify your account, then sign in.');
      onSwitchToSignIn();
    } catch (err) {
      setError(err.message || 'Error creating account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="custom-signup">
      <div className="signup-container">
        <h2>Create Your CaliScore Account</h2>
        <p className="subtitle">Join the calisthenics competition platform</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>I am a *</label>
            <div className="role-selector">
              <label className={`role-option ${formData.role === 'athlete' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value="athlete"
                  checked={formData.role === 'athlete'}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                />
                <div className="role-content">
                  <span className="role-icon">🏃</span>
                  <div>
                    <strong>Athlete</strong>
                    <p>Compete in events and track your performance</p>
                  </div>
                </div>
              </label>

              <label className={`role-option ${formData.role === 'organizer' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value="organizer"
                  checked={formData.role === 'organizer'}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                />
                <div className="role-content">
                  <span className="role-icon">📋</span>
                  <div>
                    <strong>Organizer</strong>
                    <p>Host and manage competitions</p>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>First Name *</label>
              <input
                type="text"
                value={formData.given_name}
                onChange={(e) => setFormData({...formData, given_name: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>Last Name *</label>
              <input
                type="text"
                value={formData.family_name}
                onChange={(e) => setFormData({...formData, family_name: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>Phone Number (optional)</label>
            <input
              type="tel"
              placeholder="+1234567890"
              value={formData.phone_number}
              onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
            />
            <small>Include country code (e.g., +1 for US)</small>
          </div>

          <div className="form-group">
            <label>Password *</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
              minLength={8}
            />
            <small>Minimum 8 characters with uppercase, lowercase, and numbers</small>
          </div>

          <div className="form-group">
            <label>Confirm Password *</label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
              required
            />
          </div>

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="switch-auth">
          Already have an account? <button onClick={onSwitchToSignIn}>Sign In</button>
        </p>
      </div>

      <style jsx>{`
        .custom-signup {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
        }

        .signup-container {
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          max-width: 500px;
          width: 100%;
        }

        h2 {
          margin: 0 0 10px 0;
          color: #2d3748;
          font-size: 28px;
        }

        .subtitle {
          margin: 0 0 30px 0;
          color: #4a5568;
        }

        .error-message {
          background: #fee;
          color: #c33;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 20px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }

        label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #2d3748;
        }

        input[type="text"],
        input[type="email"],
        input[type="tel"],
        input[type="password"] {
          width: 100%;
          padding: 12px;
          border: 2px solid #e2e8f0;
          border-radius: 6px;
          font-size: 16px;
          transition: border-color 0.2s;
        }

        input:focus {
          outline: none;
          border-color: #667eea;
        }

        small {
          display: block;
          margin-top: 5px;
          color: #718096;
          font-size: 13px;
        }

        .role-selector {
          display: grid;
          gap: 15px;
        }

        .role-option {
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          padding: 15px;
          cursor: pointer;
          transition: all 0.2s;
          display: block;
        }

        .role-option:hover {
          border-color: #667eea;
          background: #f7fafc;
        }

        .role-option.selected {
          border-color: #667eea;
          background: #eef2ff;
        }

        .role-option input[type="radio"] {
          display: none;
        }

        .role-content {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .role-icon {
          font-size: 32px;
        }

        .role-content strong {
          display: block;
          font-size: 16px;
          color: #2d3748;
          margin-bottom: 4px;
        }

        .role-content p {
          margin: 0;
          font-size: 14px;
          color: #718096;
        }

        .btn-submit {
          width: 100%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 14px;
          font-size: 16px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .btn-submit:hover:not(:disabled) {
          transform: translateY(-2px);
        }

        .btn-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .switch-auth {
          text-align: center;
          margin-top: 20px;
          color: #4a5568;
        }

        .switch-auth button {
          background: none;
          border: none;
          color: #667eea;
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
        }

        @media (max-width: 600px) {
          .signup-container {
            padding: 30px 20px;
          }

          .form-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default CustomSignUp;
