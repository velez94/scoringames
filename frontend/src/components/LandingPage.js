import React from 'react';
import { useNavigate } from 'react-router-dom';

function LandingPage() {
  const navigate = useNavigate();
  
  const handleGetStarted = () => {
    navigate('/login');
  };

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <header className="hero">
        <nav className="navbar">
          <div className="logo">
            <img src="/logo.svg" alt="CaliScore" className="logo-image" />
            <span className="logo-text">CaliScore</span>
          </div>
          <div className="nav-links">
            <button className="btn-events" onClick={() => navigate('/events')}>
              Events
            </button>
            <button className="btn-login" onClick={handleGetStarted}>
              Sign In
            </button>
          </div>
        </nav>

        <div className="hero-content">
          <h1 className="hero-title">
            Elevate Your Calisthenics Competitions
          </h1>
          <p className="hero-subtitle">
            The complete platform for organizing, scoring, and tracking calisthenics competitions. 
            Real-time leaderboards, multi-event management, and athlete analytics in one place.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={handleGetStarted}>
              Get Started Free
            </button>
            <button className="btn-secondary" onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}>
              Learn More
            </button>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section id="features" className="features">
        <h2 className="section-title">Everything You Need to Run Competitions</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🏆</div>
            <h3>Multi-Competition Management</h3>
            <p>Host unlimited competitions with separate leaderboards, categories, and events. Perfect for gyms and organizations.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Real-Time Scoring</h3>
            <p>Enter scores instantly and watch leaderboards update in real-time. Athletes and spectators stay engaged throughout the event.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">👥</div>
            <h3>Athlete Management</h3>
            <p>Self-service registration, category assignments, and complete athlete profiles. Streamline your competition workflow.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Advanced Analytics</h3>
            <p>Track performance trends, compare athletes across events, and generate detailed competition reports.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3>Multiple WODs per Event</h3>
            <p>Create complex competition formats with multiple workouts and scoring systems. From simple to CrossFit Games style.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Role-Based Access</h3>
            <p>Super admins, organizers, and athletes each get the right level of access. Secure and organized.</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <h2 className="section-title">How It Works</h2>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <h3>Create Your Competition</h3>
            <p>Set up your event with dates, categories, and workouts in minutes.</p>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <h3>Athletes Register</h3>
            <p>Athletes sign up and select their categories through self-service registration.</p>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <h3>Score & Track</h3>
            <p>Enter scores as events happen and watch the leaderboard update live.</p>
          </div>
          <div className="step">
            <div className="step-number">4</div>
            <h3>Celebrate Winners</h3>
            <p>Final standings, performance analytics, and shareable results.</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <h2>Ready to Transform Your Competitions?</h2>
        <p>Join gyms and organizers already using CaliScore</p>
        <button className="btn-primary" onClick={handleGetStarted}>
          Start Your Free Competition
        </button>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <img src="/logo.svg" alt="CaliScore" className="logo-image" />
            <span className="logo-text">CaliScore</span>
          </div>
          <p>© 2025 CaliScore. Built for the calisthenics community.</p>
        </div>
      </footer>

      <style jsx>{`
        .landing-page {
          min-height: 100vh;
          background: #ffffff;
        }

        /* Navbar */
        .navbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 5%;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 24px;
          font-weight: 700;
          color: #667eea;
        }

        .logo-image {
          width: 40px;
          height: 40px;
        }

        .logo-icon {
          font-size: 32px;
        }

        /* Hero Section */
        .hero {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding-bottom: 100px;
        }

        .hero-content {
          max-width: 800px;
          margin: 0 auto;
          padding: 100px 20px;
          text-align: center;
        }

        .hero-title {
          font-size: 56px;
          font-weight: 800;
          margin: 0 0 20px 0;
          line-height: 1.2;
          color: white;
        }

        .hero-subtitle {
          font-size: 20px;
          opacity: 0.95;
          margin: 0 0 40px 0;
          line-height: 1.6;
        }

        .hero-actions {
          display: flex;
          gap: 20px;
          justify-content: center;
          flex-wrap: wrap;
        }

        /* Buttons */
        .btn-primary {
          background: white;
          color: #667eea;
          border: none;
          padding: 16px 32px;
          font-size: 18px;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }

        .btn-secondary {
          background: transparent;
          color: white;
          border: 2px solid white;
          padding: 14px 32px;
          font-size: 18px;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-secondary:hover {
          background: rgba(255,255,255,0.1);
        }

        .nav-links {
          display: flex;
          gap: 15px;
          align-items: center;
        }

        .btn-events {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(102,126,234,0.3);
        }

        .btn-events:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(102,126,234,0.4);
        }

        .btn-login {
          background: white;
          color: #667eea;
          border: 2px solid white;
          padding: 10px 24px;
          font-size: 16px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-login:hover {
          background: rgba(255, 255, 255, 0.9);
        }

        /* Features Section */
        .features {
          padding: 100px 5%;
          background: #f8f9fa;
        }

        .section-title {
          text-align: center;
          font-size: 42px;
          font-weight: 700;
          margin: 0 0 60px 0;
          color: #2d3748;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 30px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .feature-card {
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.07);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .feature-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }

        .feature-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }

        .feature-card h3 {
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 15px 0;
          color: #2d3748;
        }

        .feature-card p {
          font-size: 16px;
          line-height: 1.6;
          color: #4a5568;
          margin: 0;
        }

        /* How It Works */
        .how-it-works {
          padding: 100px 5%;
          background: white;
        }

        .steps {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 40px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .step {
          text-align: center;
        }

        .step-number {
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 700;
          margin: 0 auto 20px;
        }

        .step h3 {
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 10px 0;
          color: #2d3748;
        }

        .step p {
          font-size: 16px;
          color: #4a5568;
          margin: 0;
        }

        /* CTA Section */
        .cta {
          padding: 100px 5%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-align: center;
        }

        .cta h2 {
          font-size: 42px;
          font-weight: 700;
          margin: 0 0 15px 0;
        }

        .cta p {
          font-size: 20px;
          margin: 0 0 40px 0;
          opacity: 0.95;
        }

        /* Footer */
        .footer {
          padding: 40px 5%;
          background: #2d3748;
          color: white;
          text-align: center;
        }

        .footer-content {
          max-width: 1200px;
          margin: 0 auto;
        }

        .footer-brand {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 10px;
        }

        .footer p {
          margin: 0;
          opacity: 0.8;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .navbar {
            padding: 15px 20px;
          }

          .logo {
            font-size: 20px;
          }

          .logo-image {
            width: 32px;
            height: 32px;
          }

          .nav-links {
            gap: 10px;
          }

          .btn-events,
          .btn-login {
            padding: 8px 16px;
            font-size: 14px;
          }

          .hero-content {
            padding: 60px 20px;
          }

          .hero-title {
            font-size: 36px;
          }

          .hero-subtitle {
            font-size: 18px;
          }

          .hero-actions {
            flex-direction: column;
            gap: 15px;
          }

          .btn-primary,
          .btn-secondary {
            width: 100%;
            padding: 14px 24px;
            font-size: 16px;
          }

          .section-title {
            font-size: 32px;
          }

          .features-grid {
            grid-template-columns: 1fr;
          }

          .steps {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .navbar {
            padding: 10px 15px;
          }

          .logo-text {
            display: none;
          }

          .btn-events,
          .btn-login {
            padding: 6px 12px;
            font-size: 13px;
          }

          .hero-title {
            font-size: 28px;
          }

          .hero-subtitle {
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
}

export default LandingPage;
