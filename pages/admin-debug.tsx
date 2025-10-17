import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Swal from 'sweetalert2';

const AdminDebugPage: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebugInfo = (message: string) => {
    const timestamp = new Date().toISOString();
    setDebugInfo(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  useEffect(() => {
    addDebugInfo('Admin debug page loaded');
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      addDebugInfo('Starting auth check...');
      
      const userStr = localStorage.getItem('user');
      addDebugInfo(`User string from localStorage: ${userStr ? 'Found' : 'Not found'}`);
      
      if (!userStr) {
        addDebugInfo('No user data found - redirecting to login');
        router.push('/login');
        return;
      }

      addDebugInfo('Parsing user data...');
      const userData = JSON.parse(userStr);
      addDebugInfo(`Parsed user data: ${JSON.stringify(userData, null, 2)}`);
      
      addDebugInfo(`Checking user role: ${userData.systemRole}`);
      if (userData.systemRole !== 'ADMIN') {
        addDebugInfo(`Access denied - user role is ${userData.systemRole}, not ADMIN`);
        await Swal.fire({
          icon: 'error',
          title: 'Access Denied',
          text: `Only administrators can access this page. Current role: ${userData.systemRole}`,
          confirmButtonText: 'OK'
        });
        router.push('/dashboard');
        return;
      }

      addDebugInfo('Access granted - user has ADMIN role');
      setUser(userData);
    } catch (error) {
      addDebugInfo(`Auth check error: ${error}`);
      router.push('/login');
    } finally {
      addDebugInfo('Auth check completed');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'monospace' }}>
        <h1>Admin Debug Page - Loading...</h1>
        <div style={{ background: '#f5f5f5', padding: '10px', margin: '10px 0', borderRadius: '5px' }}>
          <h3>Debug Info:</h3>
          {debugInfo.map((info, index) => (
            <div key={index} style={{ margin: '5px 0' }}>{info}</div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Admin Debug Page - HRDe Live</title>
        <meta name="description" content="Admin Debug Page" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div style={{ padding: '20px', fontFamily: 'monospace' }}>
        <h1>Admin Debug Page - Success!</h1>
        <p>If you can see this page, the admin access is working correctly.</p>
        
        <div style={{ background: '#d4edda', padding: '15px', margin: '20px 0', borderRadius: '5px', border: '1px solid #c3e6cb' }}>
          <h3>✅ User Information:</h3>
          <p><strong>ID:</strong> {user?._id}</p>
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Display Name:</strong> {user?.displayName}</p>
          <p><strong>System Role:</strong> {user?.systemRole}</p>
        </div>

        <div style={{ background: '#f5f5f5', padding: '10px', margin: '10px 0', borderRadius: '5px' }}>
          <h3>Debug Info:</h3>
          {debugInfo.map((info, index) => (
            <div key={index} style={{ margin: '5px 0' }}>{info}</div>
          ))}
        </div>

        <div style={{ margin: '20px 0' }}>
          <button 
            onClick={() => window.location.href = '/admin'} 
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '5px', 
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            Go to Real Admin Page
          </button>
          
          <button 
            onClick={() => window.location.href = '/dashboard'} 
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#28a745', 
              color: 'white', 
              border: 'none', 
              borderRadius: '5px', 
              cursor: 'pointer'
            }}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </>
  );
};

export default AdminDebugPage;


