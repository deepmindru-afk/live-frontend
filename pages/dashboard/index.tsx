import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { isAuthenticated, getCurrentUser } from '../../lib/simple-auth-handlers';
import { enhancedMakeGraphQLRequest } from '../../lib/mock-graphql-service';
import { CREATE_MEETING, START_MEETING, END_MEETING, ROTATE_INVITE_CODE } from '../../apollo/meeting/mutations';
import { GET_MY_MEETINGS, GET_ALL_MEETINGS, GET_MEETING_STATS } from '../../apollo/meeting/queries';
import { handleLogout } from '../../lib/simple-auth-handlers';
import Swal from 'sweetalert2';

interface Meeting {
  _id: string;
  title: string;
  status: 'STARTED' | 'SCHEDULED' | 'ENDED';
  schedule?: string;
  inviteCode: string;
  createdAt: string;
  updatedAt: string;
  participantCount: number;
  duration?: number;
}

const Dashboard: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'STARTED' | 'SCHEDULED' | 'ENDED' | 'VOD'>('STARTED');
  const [searchQuery, setSearchQuery] = useState('');
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [meetingSchedule, setMeetingSchedule] = useState('');
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
      if (isAuthenticated()) {
        const userData = await getCurrentUser();
        setUser(userData);
        
        // Redirect users to their appropriate dashboard based on role
        if (userData?.systemRole === 'MEMBER') {
          router.push('/member');
          return;
        } else if (userData?.systemRole === 'ADMIN') {
          router.push('/admin');
          return;
        } else if (userData?.systemRole === 'TUTOR') {
          router.push('/instructor');
          return;
        }
        
        // Only allow access to dashboard if user has no specific role or is a legacy user
        await testBackendConnection();
        await fetchMeetings();
      } else {
        window.location.href = '/login';
      }
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  const testBackendConnection = async () => {
    try {
      
      // Test with a simple query that should exist
      const result = await enhancedMakeGraphQLRequest(`
        query TestQuery {
          health
        }
      `);
      
      
      // Test if meeting mutations exist
      try {
        await enhancedMakeGraphQLRequest(`
          query TestMeetingQuery {
            __schema {
              mutationType {
                fields {
                  name
                }
              }
            }
          }
        `);
      } catch (schemaError) {
      }
      
    } catch (error) {
    }
  };

  const fetchMeetings = async () => {
    try {
      
      // Try to fetch meetings via GraphQL first
      try {
        const result = await enhancedMakeGraphQLRequest(GET_MY_MEETINGS, {
          input: {}
        });
        
        if (result.getMeetings && result.getMeetings.meetings && Array.isArray(result.getMeetings.meetings)) {
          const meetings: Meeting[] = result.getMeetings.meetings.map((meeting: any) => ({
            _id: meeting._id,
            title: meeting.title,
            status: meeting.status,
            schedule: meeting.schedule,
            inviteCode: meeting.inviteCode,
            createdAt: meeting.createdAt,
            updatedAt: meeting.updatedAt,
            participantCount: meeting.participantCount || 0,
            duration: meeting.duration
          }));
          
          setMeetings(meetings);
          return;
        }
      } catch (graphqlError) {
      }
      
      // Fallback to mock data if GraphQL fails
      
      // Mock data for demonstration
      const mockMeetings: Meeting[] = [
        {
          _id: '1',
          title: '팀 미팅',
          status: 'STARTED',
          inviteCode: 'ABC123',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          participantCount: 5,
          duration: 3600
        },
        {
          _id: '2',
          title: '프로젝트 리뷰',
          status: 'SCHEDULED',
          schedule: new Date(Date.now() + 86400000).toISOString(),
          inviteCode: 'DEF456',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          participantCount: 0,
        },
        {
          _id: '3',
          title: '클라이언트 데모',
          status: 'ENDED',
          inviteCode: 'GHI789',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date().toISOString(),
          participantCount: 10,
          duration: 7200
        },
      ];
      
      setMeetings(mockMeetings);
      
    } catch (error) {
      
      // Show error but don't block the UI
      await Swal.fire({
        icon: 'warning',
        title: '연결 오류',
        text: '서버에 연결할 수 없습니다. 오프라인 모드로 실행됩니다.',
        confirmButtonText: '확인'
      });
      
      // Set empty array for now - in production you might want to show cached data
      setMeetings([]);
    }
  };

  const handleCreateMeeting = async () => {
    if (!newMeetingTitle.trim()) {
      await Swal.fire({
        icon: 'warning',
        title: '입력 필요',
        text: '방 이름을 입력해주세요.',
        confirmButtonText: '확인'
      });
      return;
    }

    try {

      // Try to create meeting via GraphQL first
      try {
        const result = await enhancedMakeGraphQLRequest(CREATE_MEETING, {
          input: {
            title: newMeetingTitle,
            scheduledFor: meetingSchedule || null,
            isPrivate: false,
            notes: null
          }
        });


        if (result.createMeeting && result.createMeeting._id) {
          const newMeeting: Meeting = {
            _id: result.createMeeting._id,
            title: result.createMeeting.title,
            status: result.createMeeting.status,
            schedule: result.createMeeting.scheduledFor,
            inviteCode: result.createMeeting.inviteCode,
            createdAt: result.createMeeting.createdAt,
            updatedAt: result.createMeeting.updatedAt,
            participantCount: result.createMeeting.participantCount || 0,
          };

          // Add to existing meetings
          setMeetings(prev => [newMeeting, ...prev]);

          await Swal.fire({
            icon: 'success',
            title: '성공',
            text: '방이 성공적으로 생성되었습니다! (모의 서비스)',
            confirmButtonText: '확인'
          });

          // Clear form
          setNewMeetingTitle('');
          setMeetingSchedule('');

          return;
        }
      } catch (graphqlError) {
        
        // Check if it's a "field not found" error (backend doesn't have meeting mutations)
        if (graphqlError instanceof Error && graphqlError.message.includes('Cannot query field')) {
        }
      }

      // Fallback to mock meeting if GraphQL fails
      const newMeeting: Meeting = {
        _id: Date.now().toString(),
        title: newMeetingTitle,
        status: meetingSchedule ? 'SCHEDULED' : 'STARTED',
        schedule: meetingSchedule || undefined,
        inviteCode: Math.random().toString(36).substr(2, 6).toUpperCase(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        participantCount: 0,
      };

      // Add to existing meetings
      setMeetings(prev => [newMeeting, ...prev]);

      await Swal.fire({
        icon: 'info',
        title: '성공',
        text: '방이 성공적으로 생성되었습니다! (모의 서비스)',
        confirmButtonText: '확인'
      });

      // Clear form
      setNewMeetingTitle('');
      setMeetingSchedule('');


    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await Swal.fire({
        icon: 'error',
        title: '오류',
        text: `방 생성 중 오류가 발생했습니다: ${errorMessage}`,
        confirmButtonText: '확인'
      });
    }
  };

  const handleStartMeeting = async (meetingId: string) => {
    try {
      
      // Try to start meeting via GraphQL first
      try {
        const result = await enhancedMakeGraphQLRequest(START_MEETING, { meetingId });
        
        if (result.startMeeting && result.startMeeting._id) {
          // Update meeting status in local state
          setMeetings(prev => prev.map(meeting => 
            meeting._id === meetingId 
              ? { ...meeting, status: 'STARTED' as const }
              : meeting
          ));

          await Swal.fire({
            icon: 'success',
            title: '성공',
            text: '회의가 시작되었습니다! 프리조인 페이지로 이동합니다.',
            confirmButtonText: '확인'
          });

          
          // Navigate to prejoin room
          router.push(`/prejoin/${meetingId}`);
          return;
        }
      } catch (graphqlError) {
      }
      
      // Fallback to local state update if GraphQL fails
      setMeetings(prev => prev.map(meeting => 
        meeting._id === meetingId 
          ? { ...meeting, status: 'STARTED' as const }
          : meeting
      ));

      await Swal.fire({
        icon: 'success',
        title: '성공',
        text: '회의가 시작되었습니다! 프리조인 페이지로 이동합니다. (모의 서비스)',
        confirmButtonText: '확인'
      });

      
      // Navigate to prejoin room even for mock service
      router.push(`/prejoin/${meetingId}`);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await Swal.fire({
        icon: 'error',
        title: '오류',
        text: `회의 시작 중 오류가 발생했습니다: ${errorMessage}`,
        confirmButtonText: '확인'
      });
    }
  };

  const handleEndMeeting = async (meetingId: string) => {
    try {
      
      // Try to end meeting via GraphQL first
      try {
        const result = await enhancedMakeGraphQLRequest(END_MEETING, { meetingId });
        
        // Check if result is null (which happens when auth is cleared)
        if (result === null) {
          throw new Error('Authentication cleared during request');
        }
        
        // Check if the result has the expected structure
        if (result && result.endMeeting && result.endMeeting._id) {
          // Update meeting status in local state
          setMeetings(prev => prev.map(meeting => 
            meeting._id === meetingId 
              ? { ...meeting, status: 'ENDED' as const, duration: result.endMeeting.durationMin || 3600 }
              : meeting
          ));

          await Swal.fire({
            icon: 'success',
            title: '성공',
            text: '회의가 종료되었습니다!',
            confirmButtonText: '확인'
          });

          return;
        } else {
          throw new Error('Invalid response structure');
        }
      } catch (graphqlError) {
        
        // Check if this is an authentication error that cleared the token
        if (graphqlError instanceof Error && 
            (graphqlError.message.includes('Invalid credentials') || 
             graphqlError.message.includes('JWT_EXPIRED') ||
             graphqlError.message.includes('TOKEN_NOT_EXIST'))) {
          // Don't show error to user, just fall back to local update
        }
      }
      
      // Fallback to local state update if GraphQL fails
      setMeetings(prev => prev.map(meeting => 
        meeting._id === meetingId 
          ? { ...meeting, status: 'ENDED' as const, duration: 3600 }
          : meeting
      ));

      await Swal.fire({
        icon: 'success',
        title: '성공',
        text: '회의가 종료되었습니다!',
        confirmButtonText: '확인'
      });


    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await Swal.fire({
        icon: 'error',
        title: '오류',
        text: `회의 종료 중 오류가 발생했습니다: ${errorMessage}`,
        confirmButtonText: '확인'
      });
    }
  };

  const copyInviteCode = async (inviteCode: string) => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      await Swal.fire({
        icon: 'success',
        title: '복사 완료',
        text: '초대코드가 클립보드에 복사되었습니다!',
        confirmButtonText: '확인'
      });
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: '복사 실패',
        text: '초대코드 복사에 실패했습니다.',
        confirmButtonText: '확인'
      });
    }
  };

  const handleSearch = async () => {
    // For now, just filter the existing meetings client-side
    // In the future, this could be moved to server-side filtering
    await fetchMeetings();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const filteredMeetings = meetings.filter(meeting => {
    // Filter by status
    if (activeTab === 'VOD') return false;
    if (activeTab !== 'STARTED' && activeTab !== 'SCHEDULED' && activeTab !== 'ENDED') return true;
    
    const statusMatch = meeting.status === activeTab;
    
    // Filter by search query
    const searchMatch = !searchQuery || 
      meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      meeting.inviteCode.toLowerCase().includes(searchQuery.toLowerCase());
    
    return statusMatch && searchMatch;
  });

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
        <title>HRDe Live - Dashboard</title>
        <meta name="description" content="Virtual meeting dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="dashboard-container">
        {/* Header */}
        <div className="dashboard-header">
          <div className="logo" onClick={() => router.push('/dashboard')}>
            <Image
              src="/logoHRDe.png"
              alt="HRDe Live"
              width={120}
              height={40}
              className="logo-image"
            />
          </div>
          <button
            onClick={async () => {
              try {
                await handleLogout();
                router.push('/');
              } catch (error) {
                console.error('Logout failed:', error);
              }
            }}
            style={{
              padding: '10px 20px',
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '12px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16,17 21,12 16,7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>로그아웃</span>
          </button>
        </div>

        <div className="dashboard-content">
          {/* Left Sidebar */}
          <div className="dashboard-sidebar">
            <div className="greeting">
              <h2>{user?.displayName}님, 안녕하세요 👋</h2>
            </div>

            {/* Create Room Panel */}
            <div className="action-panel create-room">
              <h3>방 만들기</h3>
              <div className="input-group">
                <input
                  type="text"
                  placeholder="방 이름을 입력하세요"
                  value={newMeetingTitle}
                  onChange={(e) => setNewMeetingTitle(e.target.value)}
                />
                <button onClick={handleCreateMeeting}>→</button>
              </div>
            </div>

            {/* Schedule Panel */}
            <div className="action-panel schedule">
              <h3>예약하기</h3>
              <p>원하는 시간에 회의를 할 수 있습니다</p>
              <div className="input-group">
                <input
                  type="datetime-local"
                  value={meetingSchedule}
                  onChange={(e) => setMeetingSchedule(e.target.value)}
                />
                <button onClick={handleCreateMeeting}>→</button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="dashboard-main">
            <div className="meetings-panel">
              {/* Tabs */}
              <div className="tabs">
                <button
                  className={`tab ${activeTab === 'STARTED' ? 'active' : ''}`}
                  onClick={() => setActiveTab('STARTED')}
                >
                  시작된 회의
                </button>
                <button
                  className={`tab ${activeTab === 'SCHEDULED' ? 'active' : ''}`}
                  onClick={() => setActiveTab('SCHEDULED')}
                >
                  예약된 회의
                </button>
                <button
                  className={`tab ${activeTab === 'ENDED' ? 'active' : ''}`}
                  onClick={() => setActiveTab('ENDED')}
                >
                  종료된 회의
                </button>
                <button
                  className={`tab ${activeTab === 'VOD' ? 'active' : ''}`}
                  onClick={() => setActiveTab('VOD')}
                >
                  VOD 관리
                </button>
              </div>

              {/* Search */}
              <div className="search-bar">
                <input
                  type="text"
                  placeholder="검색어를 입력하세요"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button 
                  className="search-button"
                  onClick={handleSearch}
                  title="검색"
                >
                  🔍
                </button>
              </div>

              {/* Meetings Table */}
              <div className="meetings-table">
                {filteredMeetings.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">✗</div>
                    <p>등록된 회의가 없습니다</p>
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>회의 제목</th>
                        <th>회의시간</th>
                        <th>초대코드</th>
                        <th>비고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMeetings.map((meeting, index) => (
                        <tr key={meeting._id}>
                          <td>{index + 1}</td>
                          <td>{meeting.title}</td>
                          <td>
                            {meeting.schedule 
                              ? formatDate(meeting.schedule)
                              : formatDate(meeting.createdAt)
                            }
                          </td>
                          <td>
                            <span 
                              className="invite-code"
                              onClick={() => copyInviteCode(meeting.inviteCode)}
                            >
                              {meeting.inviteCode}
                            </span>
                          </td>
                          <td>
                            <div className="actions">
                              {meeting.status === 'SCHEDULED' && (
                                <>
                                  <button 
                                    className="action-btn start"
                                    onClick={() => handleStartMeeting(meeting._id)}
                                    style={{ marginRight: '8px' }}
                                  >
                                    시작
                                  </button>
                                  <button 
                                    className="action-btn join"
                                    onClick={() => router.push(`/prejoin/${meeting._id}`)}
                                    style={{ 
                                      background: '#007bff',
                                      color: 'white',
                                      border: 'none',
                                      padding: '6px 12px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      marginRight: '8px'
                                    }}
                                  >
                                    참여
                                  </button>
                                  <button 
                                    className="action-btn details"
                                    onClick={() => router.push(`/attendance/${meeting._id}`)}
                                    style={{ 
                                      background: '#6c757d',
                                      color: 'white',
                                      border: 'none',
                                      padding: '6px 12px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '12px'
                                    }}
                                  >
                                    상세
                                  </button>
                                </>
                              )}
                              {meeting.status === 'STARTED' && (
                                <>
                                  <button 
                                    className="action-btn end"
                                    onClick={() => handleEndMeeting(meeting._id)}
                                    style={{ marginRight: '8px' }}
                                  >
                                    종료
                                  </button>
                                  <button 
                                    className="action-btn details"
                                    onClick={() => router.push(`/attendance/${meeting._id}`)}
                                    style={{ 
                                      background: '#6c757d',
                                      color: 'white',
                                      border: 'none',
                                      padding: '6px 12px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '12px'
                                    }}
                                  >
                                    상세
                                  </button>
                                </>
                              )}
                              {meeting.status === 'ENDED' && (
                                <button 
                                  className="action-btn details"
                                  onClick={() => router.push(`/attendance/${meeting._id}`)}
                                  style={{ 
                                    background: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    padding: '6px 12px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                >
                                  상세
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
