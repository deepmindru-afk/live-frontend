import React, { useEffect } from 'react';
import Head from 'next/head';
import { isAuthenticated } from '../lib/simple-auth-handlers';

const HomePage: React.FC = () => {
  useEffect(() => {
    // Redirect to dashboard if user is already authenticated
    if (isAuthenticated()) {
      window.location.href = '/dashboard';
    }
  }, []);

  return (
    <>
      <Head>
        <title>HRDe Live - Virtual Meeting Platform</title>
        <meta name="description" content="Connect, learn, and grow together in our virtual meeting platform" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="home-container">
        <div className="home-content">
          <div className="hero-section">
            <h1 className="app-title">
              <span className="meet">Meet:</span>
              <span className="mate">
                <span className="stylized-m">m</span>ate
              </span>
            </h1>
            <p className="hero-description">
              Connect, learn, and grow together in our virtual meeting platform
            </p>
          </div>

          <div className="auth-options">
            <div className="auth-cards">
              <div className="auth-card member-card">
                <h3>Member Access</h3>
                <p>Join meetings and participate in virtual sessions</p>
                <div className="card-actions">
                  <a href="/member" className="card-button primary">
                    Member Portal
                  </a>
                  <a href="/login" className="card-button secondary">
                    Member Login
                  </a>
                </div>
              </div>

              <div className="auth-card instructor-card">
                <h3>Instructor Access</h3>
                <p>Create and manage virtual meetings and content</p>
                <div className="card-actions">
                  <a href="/instructor" className="card-button primary">
                    Instructor Portal
                  </a>
                  <a href="/instructor/login" className="card-button secondary">
                    Instructor Login
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default HomePage;