import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { isAuthenticated, getCurrentUser } from '../../lib/simple-auth-handlers';
import { enhancedMakeGraphQLRequest } from '../../lib/mock-graphql-service';
import { CREATE_MEETING, START_MEETING, END_MEETING, ROTATE_INVITE_CODE } from '../../apollo/meeting/mutations';
import { GET_MY_MEETINGS, GET_ALL_MEETINGS, GET_MEETING_STATS } from '../../apollo/meeting/queries';
import ProfileDropdown from '../../components/ProfileDropdown';
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
      console.log('🔍 BACKEND TEST: Testing backend connection...');
      
      // Test with a simple query that should exist
      const result = await enhancedMakeGraphQLRequest(`
        query TestQuery {
          health
        }
      `);
      
      console.log('🔍 BACKEND TEST: Backend is reachable:', result);
      
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
        console.log('🔍 BACKEND TEST: GraphQL schema accessible');
      } catch (schemaError) {
        console.warn('🔍 BACKEND TEST: Cannot access GraphQL schema:', schemaError);
      }
      
    } catch (error) {
      console.error('🔍 BACKEND TEST: Backend connection failed:', error);
    }
  };

  const fetchMeetings = async () => {
    try {
      console.log('📊 DASHBOARD: Fetching meetings...');
      
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
          console.log('📊 DASHBOARD: Successfully loaded meetings from GraphQL:', meetings.length);
          return;
        }
      } catch (graphqlError) {
        console.warn('📊 DASHBOARD: GraphQL request failed, falling back to mock data:', graphqlError);
      }
      
      // Fallback to mock data if GraphQL fails
      console.log('📊 DASHBOARD: Using mock data - backend meeting queries not available');
      
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
      console.log('📊 DASHBOARD: Successfully loaded mock meetings:', mockMeetings.length);
      
    } catch (error) {
      console.error('📊 DASHBOARD: Error fetching meetings:', error);
      
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
      console.log('🏠 CREATE MEETING: Creating meeting with title:', newMeetingTitle);
      console.log('🏠 CREATE MEETING: Schedule:', meetingSchedule);

      // Try to create meeting via GraphQL first
      try {
        console.log('🏠 CREATE MEETING: Attempting GraphQL request...');
        const result = await enhancedMakeGraphQLRequest(CREATE_MEETING, {
          input: {
            title: newMeetingTitle,
            scheduledFor: meetingSchedule || null,
            isPrivate: false,
            notes: null
          }
        });

        console.log('🏠 CREATE MEETING: GraphQL response received:', result);

        if (result.createMeeting && result.createMeeting.success) {
          const newMeeting: Meeting = {
            _id: result.createMeeting.meeting._id,
            title: result.createMeeting.meeting.title,
            status: result.createMeeting.meeting.status,
            schedule: result.createMeeting.meeting.schedule,
            inviteCode: result.createMeeting.meeting.inviteCode,
            createdAt: result.createMeeting.meeting.createdAt,
            updatedAt: result.createMeeting.meeting.createdAt,
            participantCount: 0,
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

          console.log('🏠 CREATE MEETING: Meeting created via GraphQL:', newMeeting);
          return;
        }
      } catch (graphqlError) {
        console.warn('🏠 CREATE MEETING: GraphQL request failed:', graphqlError);
        
        // Check if it's a "field not found" error (backend doesn't have meeting mutations)
        if (graphqlError instanceof Error && graphqlError.message.includes('Cannot query field')) {
          console.warn('🏠 CREATE MEETING: Backend does not have meeting mutations implemented');
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

      console.log('🏠 CREATE MEETING: Mock meeting created:', newMeeting);

    } catch (error: unknown) {
      console.error('🏠 CREATE MEETING: Error:', error);
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
      console.log('▶️ START MEETING: Starting meeting:', meetingId);
      
      // Try to start meeting via GraphQL first
      try {
        const result = await enhancedMakeGraphQLRequest(START_MEETING, { meetingId });
        
        if (result.startMeeting && result.startMeeting.success) {
          // Update meeting status in local state
          setMeetings(prev => prev.map(meeting => 
            meeting._id === meetingId 
              ? { ...meeting, status: 'STARTED' as const }
              : meeting
          ));

          await Swal.fire({
            icon: 'success',
            title: '성공',
            text: '회의가 시작되었습니다!',
            confirmButtonText: '확인'
          });

          console.log('▶️ START MEETING: Meeting started via GraphQL:', meetingId);
          return;
        }
      } catch (graphqlError) {
        console.warn('▶️ START MEETING: GraphQL request failed, falling back to local update:', graphqlError);
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
        text: '회의가 시작되었습니다! (모의 서비스)',
        confirmButtonText: '확인'
      });

      console.log('▶️ START MEETING: Mock meeting started:', meetingId);

    } catch (error: unknown) {
      console.error('▶️ START MEETING: Error:', error);
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
      console.log('⏹️ END MEETING: Ending meeting:', meetingId);
      
      // Try to end meeting via GraphQL first
      try {
        const result = await enhancedMakeGraphQLRequest(END_MEETING, { meetingId });
        
        if (result.endMeeting && result.endMeeting.success) {
          // Update meeting status in local state
          setMeetings(prev => prev.map(meeting => 
            meeting._id === meetingId 
              ? { ...meeting, status: 'ENDED' as const, duration: result.endMeeting.meeting.duration || 3600 }
              : meeting
          ));

          await Swal.fire({
            icon: 'success',
            title: '성공',
            text: '회의가 종료되었습니다!',
            confirmButtonText: '확인'
          });

          console.log('⏹️ END MEETING: Meeting ended via GraphQL:', meetingId);
          return;
        }
      } catch (graphqlError) {
        console.warn('⏹️ END MEETING: GraphQL request failed, falling back to local update:', graphqlError);
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
        text: '회의가 종료되었습니다! (모의 서비스)',
        confirmButtonText: '확인'
      });

      console.log('⏹️ END MEETING: Mock meeting ended:', meetingId);

    } catch (error: unknown) {
      console.error('⏹️ END MEETING: Error:', error);
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
      console.error('Copy failed:', error);
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
        <title>Meet: mate - Dashboard</title>
        <meta name="description" content="Virtual meeting dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="dashboard-container">
        {/* Header */}
        <div className="dashboard-header">
          <div className="logo" onClick={() => router.push('/dashboard')}>
            <Image
              src="/logoHRDe.png"
              alt="Meet: mate"
              width={120}
              height={40}
              className="logo-image"
            />
          </div>
          <div className="user-info">
            {user && <ProfileDropdown user={user} />}
          </div>
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
                                <button 
                                  className="action-btn start"
                                  onClick={() => handleStartMeeting(meeting._id)}
                                >
                                  시작
                                </button>
                              )}
                              {meeting.status === 'STARTED' && (
                                <button 
                                  className="action-btn end"
                                  onClick={() => handleEndMeeting(meeting._id)}
                                >
                                  종료
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
