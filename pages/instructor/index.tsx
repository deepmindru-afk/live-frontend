import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { isAuthenticated, getCurrentUser, handleLogout } from '../../lib/simple-auth-handlers';

const InstructorDashboard: React.FC = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (isAuthenticated()) {
        const userData = await getCurrentUser();
        setUser(userData);
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const handleLogoutClick = () => {
    handleLogout();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Meet: mate - Instructor Dashboard</title>
        <meta name="description" content="Instructor dashboard for Meet: mate" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="home-container instructor-auth">
        <div className="home-content">
          <div className="hero-section">
            <h1 className="app-title">
              <span className="meet">Meet:</span>
              <span className="mate">
                <span className="stylized-m">m</span>ate
              </span>
            </h1>
            <p className="hero-description">
              Instructor Dashboard - Create and manage virtual meetings
            </p>
          </div>

          {user ? (
            <div className="user-dashboard">
              <h2>Welcome back, Instructor {user.displayName}!</h2>
              <p>You are logged in as a {user.systemRole}</p>
              
              <div className="dashboard-actions">
                <button className="action-button primary" onClick={handleLogoutClick}>
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <div className="auth-options">
              <div className="auth-cards">
                <div className="auth-card instructor-card">
                  <h3>Instructor Access</h3>
                  <p>Create and manage virtual meetings and content</p>
                  <div className="card-actions">
                    <Link href="/instructor/login" className="card-button primary">
                      Instructor Login
                    </Link>
                    <Link href="/instructor/signup" className="card-button secondary">
                      Instructor Signup
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default InstructorDashboard;
