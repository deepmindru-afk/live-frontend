import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { isAuthenticated, getCurrentUser } from '../../lib/simple-auth-handlers';
import RedesignedLiveStreamRoom from '../../components/RedesignedLiveStreamRoom';

const RedesignedLiveStreamPage: React.FC = () => {
  const router = useRouter();
  const { meetingId } = router.query;
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authStatus = isAuthenticated();
        setIsAuth(authStatus);
        
        if (authStatus) {
          const currentUser = getCurrentUser();
          setUser(currentUser);
        } else {
          // Redirect to login if not authenticated
          router.push('/login');
        }
      } catch (error) {
        console.error('❌ AUTH: Error checking authentication:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: 'white'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!isAuth || !meetingId) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: 'white'
      }}>
        <div>Access Denied</div>
      </div>
    );
  }

  // Determine user role based on user data
  const role = user?.systemRole === 'TUTOR' || user?.systemRole === 'ADMIN' ? 'HOST' : 'PARTICIPANT';

  return (
    <RedesignedLiveStreamRoom
      meetingId={meetingId as string}
      role={role}
      userId={user?._id || user?.id}
    />
  );
};

export default RedesignedLiveStreamPage;
