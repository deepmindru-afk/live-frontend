import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { isAuthenticated, getCurrentUser, handleLogout } from '../../lib/simple-auth-handlers';

const MemberDashboard: React.FC = () => {
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
        <title>Meet: mate - Member Dashboard</title>
        <meta name="description" content="Member dashboard for Meet: mate" />
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
              Member Dashboard - Connect, learn, and grow together
            </p>
          </div>

          {user ? (
            <div className="user-dashboard">
              <h2>Welcome back, {user.displayName}!</h2>
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
                <div className="auth-card member-card">
                  <h3>Member Access</h3>
                  <p>Join meetings and participate in virtual sessions</p>
                  <div className="card-actions">
                    <Link href="/login" className="card-button primary">
                      Member Login
                    </Link>
                    <Link href="/signup" className="card-button secondary">
                      Member Signup
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

export default MemberDashboard;
