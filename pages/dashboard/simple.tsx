import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { isAuthenticated, getCurrentUser } from '../../lib/simple-auth-handlers';
import { enhancedMakeGraphQLRequest } from '../../lib/mock-graphql-service';
import { CREATE_MEETING, START_MEETING, END_MEETING } from '../../apollo/meeting/mutations';
import { GET_MY_MEETINGS } from '../../apollo/meeting/queries';
import { handleLogout } from '../../lib/simple-auth-handlers';

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

const SimpleDashboard: React.FC = () => {
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
        
        // Mock data for now
        setMeetings([
          {
            _id: '1',
            title: 'Team Meeting',
            status: 'STARTED',
            inviteCode: 'ABC123',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            participantCount: 5,
            duration: 3600
          },
          {
            _id: '2',
            title: 'Project Review',
            status: 'SCHEDULED',
            schedule: new Date(Date.now() + 86400000).toISOString(),
            inviteCode: 'DEF456',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            participantCount: 0,
          }
        ]);
      } else {
        window.location.href = '/login';
      }
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  const handleCreateMeeting = async () => {
    if (!newMeetingTitle.trim()) {
      alert('Please enter a meeting title');
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

          setMeetings([...meetings, newMeeting]);
          setNewMeetingTitle('');
          setMeetingSchedule('');
          alert('Meeting created successfully! (Mock Service)');
          return;
        }
      } catch (graphqlError) {
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

      setMeetings([...meetings, newMeeting]);
      setNewMeetingTitle('');
      setMeetingSchedule('');
      alert('Meeting created successfully! (Mock Service)');
    } catch (error) {
      alert('Error creating meeting: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleStartMeeting = async (meetingId: string) => {
    try {
      // Try to start meeting via GraphQL first
      try {
        const result = await enhancedMakeGraphQLRequest(START_MEETING, { meetingId });
        
        if (result.startMeeting && result.startMeeting._id) {
          setMeetings(meetings.map(meeting => 
            meeting._id === meetingId 
              ? { ...meeting, status: 'STARTED' as const }
              : meeting
          ));
          alert('Meeting started! Navigating to prejoin page...');
          
          // Navigate to prejoin room
          router.push(`/prejoin/${meetingId}`);
          return;
        }
      } catch (graphqlError) {
      }
      
      // Fallback to local state update if GraphQL fails
      setMeetings(meetings.map(meeting => 
        meeting._id === meetingId 
          ? { ...meeting, status: 'STARTED' as const }
          : meeting
      ));
      alert('Meeting started! Navigating to prejoin page... (Mock Service)');
      
      // Navigate to prejoin room even for mock service
      router.push(`/prejoin/${meetingId}`);
    } catch (error) {
      alert('Error starting meeting: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleEndMeeting = async (meetingId: string) => {
    try {
      // Try to end meeting via GraphQL first
      try {
        const result = await enhancedMakeGraphQLRequest(END_MEETING, { meetingId });
        
        if (result.endMeeting && result.endMeeting._id) {
          setMeetings(meetings.map(meeting => 
            meeting._id === meetingId 
              ? { ...meeting, status: 'ENDED' as const, duration: result.endMeeting.durationMin || 3600 }
              : meeting
          ));
          alert('Meeting ended! (Mock Service)');
          return;
        }
      } catch (graphqlError) {
      }
      
      // Fallback to local state update if GraphQL fails
      setMeetings(meetings.map(meeting => 
        meeting._id === meetingId 
          ? { ...meeting, status: 'ENDED' as const, duration: 3600 }
          : meeting
      ));
      alert('Meeting ended! (Mock Service)');
    } catch (error) {
      alert('Error ending meeting: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const copyInviteCode = (inviteCode: string) => {
    navigator.clipboard.writeText(inviteCode);
    alert('Invite code copied to clipboard!');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const filteredMeetings = meetings.filter(meeting => {
    if (activeTab === 'VOD') return false;
    if (activeTab !== 'STARTED' && activeTab !== 'SCHEDULED' && activeTab !== 'ENDED') return true;
    return meeting.status === activeTab;
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
          <div className="logo">
            <h1>HRDe Live</h1>
          </div>
          <button
            onClick={async () => {
              try {
                await handleLogout();
                router.push('/');
              } catch (error) {
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
                <span className="search-icon">🔍</span>
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

export default SimpleDashboard;
