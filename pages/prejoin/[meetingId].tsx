import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Swal from 'sweetalert2';
import { makeGraphQLRequest } from '../../lib/simple-auth-handlers';
import { GET_MEETING_BY_ID } from '../../apollo/meeting/queries';
import { CREATE_MEETING, START_MEETING, JOIN_MEETING } from '../../apollo/meeting/mutations';
import { CreateMeetingInput, JoinParticipantInput, Meeting } from '../../types/meeting';
import { isValidObjectId, getInvalidIdErrorMessage } from '../../lib/validation';

interface MeetingInfo {
  _id: string;
  title: string;
  status: string;
  inviteCode: string;
}

const PrejoinPage = () => {
  const router = useRouter();
  const { meetingId } = router.query;
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Debug logging
  useEffect(() => {
    console.log('🔍 PREJOIN DEBUG:', {
      meetingId,
      isLoading,
      meetingInfo
    });
  }, [meetingId, isLoading, meetingInfo]);

  const fetchMeetingInfo = async () => {
    try {
      console.log('🔍 PREJOIN: Fetching meeting info for ID:', meetingId);
      
      // Check if meetingId is a valid MongoDB ObjectId
      if (!isValidObjectId(meetingId as string)) {
        console.log('🔍 PREJOIN: Invalid meeting ID format, redirecting to instructor dashboard');
        await Swal.fire({
          icon: 'error',
          title: 'Invalid Meeting ID',
          text: getInvalidIdErrorMessage(meetingId as string),
          confirmButtonText: 'Go to Dashboard'
        });
        router.push('/instructor');
        return;
      }
      
      // Wrap the GraphQL request in a try-catch to handle auth errors gracefully
      let result;
      try {
        result = await makeGraphQLRequest(GET_MEETING_BY_ID, {
          meetingId: meetingId as string
        });
      } catch (authError: any) {
        // Handle authentication errors immediately
        if (authError.message === 'JWT_EXPIRED' || authError.message === 'TOKEN_NOT_EXIST' || authError.message === 'Invalid credentials') {
          await Swal.fire({
            icon: 'warning',
            title: '세션이 만료되었습니다',
            text: '다시 로그인해 주세요.',
            confirmButtonText: '로그인',
            showCancelButton: true,
            cancelButtonText: '취소'
          }).then((result) => {
            if (result.isConfirmed) {
              // Clear any stored tokens
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              // Redirect to login
              router.push('/login');
            } else {
              // Redirect to dashboard
              router.push('/instructor');
            }
          });
          return;
        }
        // Re-throw other errors
        throw authError;
      }
      
      console.log('🔍 PREJOIN: Raw backend response:', result);
      
      if (result.getMeetingById) {
        // Check if required fields exist
        if (!result.getMeetingById._id) {
          throw new Error('Meeting ID is missing from response');
        }
        
        const meeting: MeetingInfo = {
          _id: result.getMeetingById._id,
          title: result.getMeetingById.title || 'Untitled Meeting',
          status: result.getMeetingById.status === 'CREATED' ? 'SCHEDULED' : 
                  result.getMeetingById.status === 'SCHEDULED' ? 'SCHEDULED' : 
                  result.getMeetingById.status === 'ENDED' ? 'ENDED' : 'SCHEDULED',
          inviteCode: result.getMeetingById.inviteCode || 'N/A'
        };
        
        console.log('🔍 PREJOIN: Processed meeting data:', meeting);
        setMeetingInfo(meeting);
      } else {
        throw new Error('Meeting not found');
      }
    } catch (error: any) {
      console.error('🔍 PREJOIN: Error fetching meeting info:', error);
      
      // Handle authentication errors specifically
      if (error.message === 'JWT_EXPIRED' || error.message === 'TOKEN_NOT_EXIST' || error.message === 'Invalid credentials') {
        await Swal.fire({
          icon: 'warning',
          title: '세션이 만료되었습니다',
          text: '다시 로그인해 주세요.',
          confirmButtonText: '로그인',
          showCancelButton: true,
          cancelButtonText: '취소'
        }).then((result) => {
          if (result.isConfirmed) {
            // Clear any stored tokens
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // Redirect to login
            router.push('/login');
          } else {
            // Redirect to dashboard
            router.push('/dashboard');
          }
        });
      } else {
        // Handle other errors
        const errorMessage = error.message || '미팅 정보를 가져올 수 없습니다.';
        await Swal.fire({
          icon: 'error',
          title: '미팅 정보 오류',
          text: errorMessage,
          confirmButtonText: '확인'
        });
        router.push('/instructor'); // Redirect to instructor dashboard
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (meetingId) {
      fetchMeetingInfo();
    }
  }, [meetingId]);

  const handleJoinMeeting = async () => {
    if (!meetingId) return;

    setIsJoining(true);
    setJoinError(null);

    try {
      console.log('🔍 PREJOIN: Joining meeting with ID:', meetingId);
      
      // Join the meeting
      const joinResult = await makeGraphQLRequest(JOIN_MEETING, {
        input: {
          meetingId: meetingId as string,
          displayName: 'Participant'
          // Don't send role - let backend determine it
        } as JoinParticipantInput
      });

      console.log('🔍 PREJOIN: Join meeting result:', joinResult);

      if (joinResult.joinMeeting && joinResult.joinMeeting._id) {
        console.log('✅ Successfully joined meeting:', joinResult.joinMeeting);
        // Navigate to live room
        router.push(`/livestream/${meetingId}`);
      } else {
        throw new Error('Failed to join meeting');
      }
    } catch (error: any) {
      console.error('❌ Failed to join meeting:', error);
      setJoinError(error.message || 'Failed to join meeting');
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateAndStartMeeting = async () => {
    setIsJoining(true);
    setJoinError(null);

    try {
      console.log('🔍 PREJOIN: Creating new meeting');
      
      // Create meeting
      const createResult = await makeGraphQLRequest(CREATE_MEETING, {
        input: {
          title: 'Live Stream Session',
          notes: 'Professional live streaming session',
          isPrivate: false,
          scheduledFor: new Date().toISOString()
        } as CreateMeetingInput
      });

      console.log('🔍 PREJOIN: Create meeting result:', createResult);

      if (!createResult.createMeeting || !createResult.createMeeting._id) {
        throw new Error('Failed to create meeting');
      }

      const newMeetingId = createResult.createMeeting._id;
      console.log('✅ Meeting created:', newMeetingId);

      // Start meeting
      const startResult = await makeGraphQLRequest(START_MEETING, {
        meetingId: newMeetingId
      });

      console.log('🔍 PREJOIN: Start meeting result:', startResult);

      if (!startResult.startMeeting || !startResult.startMeeting._id) {
        throw new Error('Failed to start meeting');
      }

      console.log('✅ Meeting started');

      // Navigate to live room
      router.push(`/livestream/${newMeetingId}`);
    } catch (error: any) {
      console.error('❌ Failed to create/start meeting:', error);
      setJoinError(error.message || 'Failed to create meeting');
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column'
      }}>
        <div style={{ 
          width: '50px', 
          height: '50px', 
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #007bff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ marginTop: '20px', color: '#666' }}>Loading meeting...</p>
        <div style={{ marginTop: '20px', fontSize: '12px', color: '#999' }}>
          <p>Meeting ID: {meetingId}</p>
          <p>Status: Loading...</p>
        </div>
      </div>
    );
  }

  if (!meetingInfo) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        padding: '20px'
      }}>
        <h2 style={{ color: '#f59e0b', marginBottom: '20px' }}>Meeting Not Found</h2>
        <p style={{ color: '#666', marginBottom: '20px', textAlign: 'center' }}>
          The meeting with ID "{meetingId}" could not be found.
        </p>
        <button
          onClick={handleCreateAndStartMeeting}
          disabled={isJoining}
          style={{
            padding: '10px 20px',
            backgroundColor: isJoining ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isJoining ? 'not-allowed' : 'pointer'
          }}
        >
          {isJoining ? 'Creating...' : 'Create New Meeting'}
        </button>
        {joinError && (
          <div style={{
            color: '#dc3545',
            marginTop: '15px',
            padding: '10px',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '5px'
          }}>
            {joinError}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column',
      padding: '20px',
      backgroundColor: '#f8f9fa'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#333', marginBottom: '20px' }}>
          {meetingInfo.title}
        </h1>
        
        <div style={{ marginBottom: '20px' }}>
          <p style={{ color: '#666', margin: '5px 0' }}>
            <strong>Meeting ID:</strong> {meetingInfo.inviteCode}
          </p>
          <p style={{ color: '#666', margin: '5px 0' }}>
            <strong>Status:</strong> {meetingInfo.status}
          </p>
          <p style={{ color: '#666', margin: '5px 0' }}>
            <strong>Meeting ID:</strong> {meetingInfo._id ? meetingInfo._id.slice(-8) : 'N/A'}
          </p>
        </div>

        <button
          onClick={handleJoinMeeting}
          disabled={isJoining}
          style={{
            padding: '15px 30px',
            backgroundColor: isJoining ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isJoining ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            width: '100%'
          }}
        >
          {isJoining ? 'Joining...' : 'Join Meeting'}
        </button>

        {joinError && (
          <div style={{
            color: '#dc3545',
            marginTop: '15px',
            padding: '10px',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '5px'
          }}>
            {joinError}
          </div>
        )}
      </div>
    </div>
  );
};

export default PrejoinPage;