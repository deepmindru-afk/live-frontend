import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { enhancedMakeGraphQLRequest } from '../../../lib/mock-graphql-service';
import { JOIN_MEETING, LEAVE_MEETING } from '../../../apollo/meeting/mutations';
import { GET_MEETING_BY_ID } from '../../../apollo/meeting/queries';
import { UPLOAD_VOD_FILE, CREATE_VOD_FROM_URL } from '../../../apollo/vod/mutations';
import Swal from 'sweetalert2';

interface Participant {
  _id: string;
  displayName: string;
  email: string;
  isMuted: boolean;
  isCameraOff: boolean;
  joinedAt: string;
  isHost?: boolean;
}

interface Meeting {
  _id: string;
  title: string;
  status: string;
  inviteCode: string;
  participants: Participant[];
  participantCount: number;
}

const VideoRoomPage: React.FC = () => {
  const router = useRouter();
  const { meetingId } = router.query;
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentParticipantId, setCurrentParticipantId] = useState<string | null>(null);
  const [showVODUpload, setShowVODUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [urlTitle, setUrlTitle] = useState('');
  const [uploading, setUploading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenShareRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (meetingId) {
      loadMeeting();
    }
  }, [meetingId]);

  useEffect(() => {
    if (isJoined) {
      startVideo();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (screenShareRef.current) {
        screenShareRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isJoined]);

  const loadMeeting = async () => {
    try {
      setLoading(true);
      
      // Try to get meeting details
      try {
        const result = await enhancedMakeGraphQLRequest(GET_MEETING_BY_ID, {
          meetingId: meetingId
        });
        
        if (result.meeting) {
          setMeeting(result.meeting);
          setParticipantCount(result.meeting.participantCount || 0);
          setParticipants(result.meeting.participants || []);
        }
      } catch (error) {
        console.warn('Failed to load meeting details:', error);
        // Fallback to mock data
        setMeeting({
          _id: meetingId as string,
          title: 'Test Meeting',
          status: 'STARTED',
          inviteCode: 'ABC123',
          participants: [],
          participantCount: 0
        });
      }

      // Auto-join the meeting
      await joinMeeting();
      
    } catch (error: any) {
      console.error('Error loading meeting:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinMeeting = async () => {
    try {
      console.log('🎯 JOINING VIDEO ROOM:', meetingId);
      
      // Get current user info
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const displayName = user?.displayName || 'Anonymous User';
      
      const result = await enhancedMakeGraphQLRequest(JOIN_MEETING, {
        input: {
          meetingId: meetingId,
          displayName: displayName,
          inviteCode: meeting?.inviteCode
        }
      });
      
      console.log('🎯 JOIN VIDEO ROOM RESULT:', result);
      
      if (result.joinMeeting) {
        setIsJoined(true);
        setIsHost(result.joinMeeting.role === 'HOST');
        setParticipantCount(prev => prev + 1);
        setCurrentParticipantId(result.joinMeeting._id);
        
        // Add current user to participants
        const currentUser: Participant = {
          _id: result.joinMeeting._id,
          displayName: result.joinMeeting.displayName,
          email: user?.email || 'me@example.com',
          isMuted: result.joinMeeting.micState === 'OFF',
          isCameraOff: result.joinMeeting.cameraState === 'OFF',
          joinedAt: new Date().toISOString(),
          isHost: result.joinMeeting.role === 'HOST'
        };
        setParticipants(prev => [...prev, currentUser]);
        
        console.log('✅ Successfully joined video room!');
      } else {
        throw new Error('Failed to join video room');
      }
    } catch (error: any) {
      console.error('Join video room error:', error);
      await Swal.fire({
        icon: 'error',
        title: '비디오 룸 참여 실패',
        text: error.message || '비디오 룸에 참여할 수 없습니다.',
        confirmButtonText: '확인'
      });
    }
  };

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: !isCameraOff,
        audio: !isMuted
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (error) {
      console.error('Error starting video:', error);
    }
  };

  const toggleMute = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMuted;
        setIsMuted(!isMuted);
      }
    }
  };

  const toggleCamera = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = isCameraOff;
        setIsCameraOff(!isCameraOff);
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = screenStream;
          screenShareRef.current = screenStream;
        }
        setIsScreenSharing(true);
      } else {
        if (screenShareRef.current) {
          screenShareRef.current.getTracks().forEach(track => track.stop());
        }
        if (streamRef.current && videoRef.current) {
          videoRef.current.srcObject = streamRef.current;
        }
        setIsScreenSharing(false);
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
    }
  };

  const leaveMeeting = async () => {
    try {
      await Swal.fire({
        title: '미팅 종료',
        text: '정말로 미팅을 종료하시겠습니까?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '종료',
        cancelButtonText: '취소',
        confirmButtonColor: '#dc3545'
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            if (currentParticipantId) {
              await enhancedMakeGraphQLRequest(LEAVE_MEETING, {
                input: {
                  participantId: currentParticipantId
                }
              });
            }
          } catch (error) {
            console.warn('Failed to leave meeting via API:', error);
          }
          
          // Redirect based on user role
          const userStr = localStorage.getItem('user');
          const user = userStr ? JSON.parse(userStr) : null;
          const userRole = user?.systemRole;
          
          if (userRole === 'TUTOR') {
            router.push('/instructor');
          } else if (userRole === 'MEMBER') {
            router.push('/member');
          } else {
            router.push('/dashboard');
          }
        }
      });
    } catch (error) {
      console.error('Error leaving meeting:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const uploadVODFile = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const result = await enhancedMakeGraphQLRequest(UPLOAD_VOD_FILE, {
        input: {
          title: selectedFile.name,
          meetingId: meetingId as string,
          notes: `Uploaded from meeting: ${meeting?.title || 'Unknown Meeting'}`
        },
        file: selectedFile
      });

      if (result.uploadVodFile && result.uploadVodFile.success) {
        await Swal.fire({
          icon: 'success',
          title: 'VOD 업로드',
          text: 'VOD 파일이 성공적으로 업로드되었습니다.',
          timer: 2000,
          showConfirmButton: false
        });
        
        setShowVODUpload(false);
        setSelectedFile(null);
      }
    } catch (error) {
      console.error('VOD upload error:', error);
      await Swal.fire({
        icon: 'error',
        title: '업로드 실패',
        text: 'VOD 파일 업로드 중 오류가 발생했습니다.',
        confirmButtonText: '확인'
      });
    } finally {
      setUploading(false);
    }
  };

  const uploadVODFromURL = async () => {
    if (!urlInput.trim() || !urlTitle.trim()) {
      await Swal.fire({
        icon: 'warning',
        title: '입력 오류',
        text: 'URL과 제목을 모두 입력해주세요.',
        confirmButtonText: '확인'
      });
      return;
    }

    setUploading(true);
    try {
      const result = await enhancedMakeGraphQLRequest(CREATE_VOD_FROM_URL, {
        input: {
          url: urlInput,
          title: urlTitle,
          meetingId: meetingId as string,
          notes: `Created from URL for meeting: ${meeting?.title || 'Unknown Meeting'}`
        }
      });

      if (result.createVodFromUrl && result.createVodFromUrl.success) {
        await Swal.fire({
          icon: 'success',
          title: 'VOD URL 등록',
          text: 'VOD URL이 성공적으로 등록되었습니다.',
          timer: 2000,
          showConfirmButton: false
        });
        
        setShowVODUpload(false);
        setUrlInput('');
        setUrlTitle('');
      }
    } catch (error) {
      console.error('VOD URL upload error:', error);
      await Swal.fire({
        icon: 'error',
        title: '등록 실패',
        text: 'VOD URL 등록 중 오류가 발생했습니다.',
        confirmButtonText: '확인'
      });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontSize: '1.2rem'
      }}>
        <div>Loading video room...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Video Room - {meeting?.title || 'Meeting'}</title>
        <meta name="description" content="Live video meeting room" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div style={{
        height: '100vh',
        background: '#1a1a1a',
        color: 'white',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '1rem 2rem',
          background: 'rgba(0,0,0,0.8)',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{meeting?.title}</h1>
            <p style={{ margin: '0.5rem 0 0 0', color: '#ccc' }}>
              {participantCount} participants • {meeting?.inviteCode}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ color: '#4ade80' }}>● Live</span>
            <button
              onClick={leaveMeeting}
              style={{
                background: '#ef4444',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Leave Meeting
            </button>
          </div>
        </div>

        {/* Video Area */}
        <div style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          background: '#000'
        }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              background: '#000'
            }}
          />
          
          {/* Video Controls Overlay */}
          <div style={{
            position: 'absolute',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '1rem',
            background: 'rgba(0,0,0,0.8)',
            padding: '1rem 2rem',
            borderRadius: '50px',
            backdropFilter: 'blur(10px)'
          }}>
            <button
              onClick={toggleMute}
              style={{
                background: isMuted ? '#ef4444' : '#374151',
                color: 'white',
                border: 'none',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '1.2rem'
              }}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>
            
            <button
              onClick={toggleCamera}
              style={{
                background: isCameraOff ? '#ef4444' : '#374151',
                color: 'white',
                border: 'none',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '1.2rem'
              }}
            >
              {isCameraOff ? '📷' : '📹'}
            </button>
            
            <button
              onClick={toggleScreenShare}
              style={{
                background: isScreenSharing ? '#3b82f6' : '#374151',
                color: 'white',
                border: 'none',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '1.2rem'
              }}
            >
              {isScreenSharing ? '🖥️' : '📺'}
            </button>
            
            {isHost && (
              <button
                onClick={() => setShowVODUpload(true)}
                style={{
                  background: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: '1.2rem'
                }}
                title="VOD 업로드"
              >
                📁
              </button>
            )}
            
            <button
              onClick={() => setShowChat(!showChat)}
              style={{
                background: showChat ? '#3b82f6' : '#374151',
                color: 'white',
                border: 'none',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '1.2rem'
              }}
            >
              💬
            </button>
          </div>
        </div>

        {/* Chat Sidebar */}
        {showChat && (
          <div style={{
            position: 'absolute',
            right: '0',
            top: '0',
            width: '300px',
            height: '100%',
            background: 'rgba(0,0,0,0.9)',
            borderLeft: '1px solid #333',
            padding: '1rem',
            overflowY: 'auto'
          }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Chat</h3>
            <div style={{
              background: '#1f2937',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1rem'
            }}>
              <p style={{ margin: 0, color: '#9ca3af' }}>
                Welcome to the video room! This is a LiveKit-style video meeting interface.
              </p>
            </div>
            <div style={{
              position: 'absolute',
              bottom: '1rem',
              left: '1rem',
              right: '1rem',
              display: 'flex',
              gap: '0.5rem'
            }}>
              <input
                type="text"
                placeholder="Type a message..."
                style={{
                  flex: 1,
                  background: '#374151',
                  border: '1px solid #4b5563',
                  color: 'white',
                  padding: '0.5rem',
                  borderRadius: '6px'
                }}
              />
              <button
                style={{
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Send
              </button>
            </div>
          </div>
        )}

        {/* VOD Upload Modal */}
        {showVODUpload && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: '#1f2937',
              borderRadius: '12px',
              padding: '30px',
              maxWidth: '500px',
              width: '90%',
              color: 'white'
            }}>
              <h2 style={{ margin: '0 0 20px 0', color: 'white' }}>VOD 업로드</h2>
              
              {/* File Upload Tab */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 15px 0', color: '#e5e7eb' }}>파일 업로드</h3>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#374151',
                    border: '1px solid #4b5563',
                    borderRadius: '6px',
                    color: 'white',
                    marginBottom: '15px'
                  }}
                />
                {selectedFile && (
                  <p style={{ margin: '0 0 15px 0', color: '#9ca3af' }}>
                    선택된 파일: {selectedFile.name}
                  </p>
                )}
                <button
                  onClick={uploadVODFile}
                  disabled={!selectedFile || uploading}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: uploading ? '#6b7280' : '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    marginBottom: '20px'
                  }}
                >
                  {uploading ? '업로드 중...' : '파일 업로드'}
                </button>
              </div>

              {/* URL Upload Tab */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 15px 0', color: '#e5e7eb' }}>URL 등록</h3>
                <input
                  type="text"
                  value={urlTitle}
                  onChange={(e) => setUrlTitle(e.target.value)}
                  placeholder="VOD 제목을 입력하세요"
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#374151',
                    border: '1px solid #4b5563',
                    borderRadius: '6px',
                    color: 'white',
                    marginBottom: '10px'
                  }}
                />
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="VOD URL을 입력하세요"
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#374151',
                    border: '1px solid #4b5563',
                    borderRadius: '6px',
                    color: 'white',
                    marginBottom: '15px'
                  }}
                />
                <button
                  onClick={uploadVODFromURL}
                  disabled={uploading}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: uploading ? '#6b7280' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    marginBottom: '20px'
                  }}
                >
                  {uploading ? '등록 중...' : 'URL 등록'}
                </button>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px'
              }}>
                <button
                  onClick={() => setShowVODUpload(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default VideoRoomPage;







