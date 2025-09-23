import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { isAuthenticated, getCurrentUser, handleLogout } from '../../lib/simple-auth-handlers';
import { makeGraphQLRequest } from '../../lib/simple-auth-handlers';
import { GET_MY_MEETINGS, GET_MEETING_BY_ID, GET_MEETING_STATS } from '../../apollo/meeting/queries';
import { JOIN_MEETING_BY_CODE } from '../../apollo/meeting/mutations';

import { UPDATE_PROFILE, UPLOAD_PROFILE_IMAGE, DELETE_PROFILE_IMAGE } from '../../apollo/member/mutations';
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

interface User {
  _id: string;
  displayName: string;
  email: string;
  systemRole: string;
  avatarUrl?: string;
  department?: string;
  phone?: string;
}

const MemberDashboard: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'meetings' | 'profile' | 'join'>('meetings');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filteredMeetings, setFilteredMeetings] = useState<Meeting[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [profileData, setProfileData] = useState({
    displayName: '',
    department: '',
    phone: ''
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      if (isAuthenticated()) {
        const userData = await getCurrentUser();
        if (userData && userData.systemRole === 'MEMBER') {
        setUser(userData);
          setProfileData({
            displayName: userData.displayName || '',
            department: userData.department || '',
            phone: userData.phone || ''
          });
          await fetchMeetings();
        } else {
          // Redirect non-members to appropriate dashboard
          if (userData?.systemRole === 'TUTOR') {
            router.push('/instructor');
          } else if (userData?.systemRole === 'ADMIN') {
            router.push('/admin');
          } else {
            router.push('/login'); // Redirect to login if unknown role
          }
        }
      } else {
        router.push('/login');
      }
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  const fetchMeetings = async () => {
    try {
      console.log('📊 MEMBER DASHBOARD: Fetching meetings...');
      
      if (!GET_MY_MEETINGS) {
        console.error('📊 MEMBER DASHBOARD: GET_MY_MEETINGS query is undefined');
        setMeetings([]);
        return;
      }
      
      const result = await makeGraphQLRequest(GET_MY_MEETINGS, {
        input: {}
      });
      
      console.log('📊 MEMBER DASHBOARD: Backend response:', result);
      
      if (result.getMeetings && result.getMeetings.meetings && Array.isArray(result.getMeetings.meetings)) {
        const meetings = result.getMeetings.meetings.map((meeting: any) => ({
          _id: meeting._id,
          title: meeting.title,
          status: meeting.status === 'CREATED' ? 'STARTED' : 
                  meeting.status === 'SCHEDULED' ? 'SCHEDULED' : 
                  meeting.status === 'ENDED' ? 'ENDED' : 'STARTED',
          schedule: meeting.scheduledFor,
          inviteCode: meeting.inviteCode,
          createdAt: meeting.createdAt,
          updatedAt: meeting.updatedAt || meeting.createdAt,
          participantCount: meeting.participantCount || 0,
          duration: meeting.duration
        }));
        
        setMeetings(meetings);
        setFilteredMeetings(meetings);
        console.log('📊 MEMBER DASHBOARD: Successfully loaded meetings:', meetings.length);
      } else {
        console.warn('📊 MEMBER DASHBOARD: No meetings found in response');
        setMeetings([]);
        setFilteredMeetings([]);
      }
    } catch (error) {
      console.error('📊 MEMBER DASHBOARD: Error fetching meetings:', error);
      setMeetings([]);
      setFilteredMeetings([]);
    }
  };

  // Filter meetings based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredMeetings(meetings);
    } else {
      const filtered = meetings.filter(meeting =>
        meeting.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMeetings(filtered);
    }
  }, [searchQuery, meetings]);

  const handleJoinByCode = async () => {
    if (!inviteCode.trim()) {
      await Swal.fire({
        icon: 'warning',
        title: '입력 오류',
        text: '초대코드를 입력해주세요.',
        confirmButtonText: '확인'
      });
      return;
    }

    try {
      const result = await makeGraphQLRequest(JOIN_MEETING_BY_CODE, { 
        input: { inviteCode } 
      });
      
      if (result.joinMeetingByCode && result.joinMeetingByCode.success) {
        // Redirect to pre-join device check page
        const meetingId = result.joinMeetingByCode.meeting._id;
        router.push(`/prejoin/${meetingId}`);
      } else {
        throw new Error(result.joinMeetingByCode?.message || '미팅 참여에 실패했습니다.');
      }
    } catch (error) {
      console.error('Join meeting error:', error);
      await Swal.fire({
        icon: 'error',
        title: '미팅 참여 실패',
        text: error instanceof Error ? error.message : '미팅 참여 중 오류가 발생했습니다.',
        confirmButtonText: '확인'
      });
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const result = await makeGraphQLRequest(UPDATE_PROFILE, {
        input: profileData
      });

      if (result.updateProfile && result.updateProfile.success) {
        await Swal.fire({
          icon: 'success',
          title: '프로필 업데이트',
          text: '프로필이 성공적으로 업데이트되었습니다.',
          timer: 2000,
          showConfirmButton: false
        });
        
        setIsEditingProfile(false);
        // Refresh user data
        const userData = await getCurrentUser();
        if (userData) {
          setUser(userData);
        }
      }
    } catch (error) {
      console.error('Update profile error:', error);
      await Swal.fire({
        icon: 'error',
        title: '업데이트 실패',
        text: '프로필 업데이트 중 오류가 발생했습니다.',
        confirmButtonText: '확인'
      });
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await makeGraphQLRequest(UPLOAD_PROFILE_IMAGE, {
        file: file
      });

      if (result.uploadProfileImage && result.uploadProfileImage.success) {
        await Swal.fire({
          icon: 'success',
          title: '이미지 업로드',
          text: '프로필 이미지가 성공적으로 업로드되었습니다.',
          timer: 2000,
          showConfirmButton: false
        });
        
        // Refresh user data
        const userData = await getCurrentUser();
        if (userData) {
          setUser(userData);
        }
      }
    } catch (error) {
      console.error('Image upload error:', error);
      await Swal.fire({
        icon: 'error',
        title: '업로드 실패',
        text: '이미지 업로드 중 오류가 발생했습니다.',
        confirmButtonText: '확인'
      });
    }
  };

  const handleDeleteImage = async () => {
    const result = await Swal.fire({
      title: '이미지 삭제',
      text: '프로필 이미지를 삭제하시겠습니까?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '삭제',
      cancelButtonText: '취소',
      confirmButtonColor: '#dc3545'
    });

    if (result.isConfirmed) {
      try {
        await makeGraphQLRequest(DELETE_PROFILE_IMAGE);
        
        await Swal.fire({
          icon: 'success',
          title: '이미지 삭제',
          text: '프로필 이미지가 성공적으로 삭제되었습니다.',
          timer: 2000,
          showConfirmButton: false
        });
        
        // Refresh user data
        const userData = await getCurrentUser();
        if (userData) {
          setUser(userData);
        }
      } catch (error) {
        console.error('Delete image error:', error);
        await Swal.fire({
          icon: 'error',
          title: '삭제 실패',
          text: '이미지 삭제 중 오류가 발생했습니다.',
          confirmButtonText: '확인'
        });
      }
    }
  };

  const handleLogoutClick = async () => {
    const result = await Swal.fire({
      title: '로그아웃',
      text: '정말 로그아웃하시겠습니까?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '로그아웃',
      cancelButtonText: '취소'
    });

    if (result.isConfirmed) {
      await handleLogout();
      router.push('/login');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px'
      }}>
        로딩 중...
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>HRDe Live - Member Dashboard</title>
        <meta name="description" content="Member dashboard for HRDe Live" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f8f9fa',
        display: 'flex'
      }}>
        {/* Left Sidebar */}
        <div style={{
          width: '300px',
          backgroundColor: '#f1f3f4',
          padding: '30px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Logo */}
          <div style={{
            marginBottom: '40px',
            display: 'flex',
            justifyContent: 'center'
          }}>
            <Image
              src="/logoHRDe.png"
              alt="HRDE"
              width={120}
              height={55}
              style={{
                objectFit: 'contain'
              }}
            />
          </div>

          {/* Welcome Message */}
          <div style={{
            marginBottom: '40px'
          }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 'bold',
              margin: 0,
              color: '#333'
            }}>
              {user?.displayName}님, 안녕하세요 👋
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#666',
              margin: '5px 0 0 0'
            }}>
              Member Dashboard
            </p>
          </div>

          {/* Navigation */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <button
              onClick={() => setActiveTab('meetings')}
              style={{
                padding: '15px 20px',
                backgroundColor: activeTab === 'meetings' ? '#e3f2fd' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '16px',
                color: activeTab === 'meetings' ? '#1976d2' : '#333'
              }}
            >
              📅 내 미팅
            </button>
            <button
              onClick={() => setActiveTab('join')}
              style={{
                padding: '15px 20px',
                backgroundColor: activeTab === 'join' ? '#e3f2fd' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '16px',
                color: activeTab === 'join' ? '#1976d2' : '#333'
              }}
            >
              🔗 미팅 참여
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              style={{
                padding: '15px 20px',
                backgroundColor: activeTab === 'profile' ? '#e3f2fd' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '16px',
                color: activeTab === 'profile' ? '#1976d2' : '#333'
              }}
            >
              👤 프로필 관리
            </button>
          </div>

          {/* Logout Button */}
          <div style={{
            marginTop: 'auto',
            paddingTop: '20px'
          }}>
            <button
              onClick={handleLogoutClick}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{
          flex: 1,
          backgroundColor: 'white',
          padding: '30px'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '30px'
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '24px',
              color: '#333'
            }}>
              {activeTab === 'meetings' && '내 미팅'}
              {activeTab === 'join' && '미팅 참여'}
              {activeTab === 'profile' && '프로필 관리'}
            </h2>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '15px'
            }}>
              {user?.avatarUrl && (
                <img
                  src={user.avatarUrl}
                  alt="Profile"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    objectFit: 'cover'
                  }}
                />
              )}
              <span style={{
                fontSize: '16px',
                color: '#333'
              }}>
                {user?.displayName}
              </span>
            </div>
          </div>

          {/* Content based on active tab */}
          {activeTab === 'meetings' && (
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
              }}>
                <h3>내가 참여한 미팅</h3>
                <button
                  onClick={fetchMeetings}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  새로고침
                </button>
              </div>

              {/* Search Input */}
              <div style={{
                marginBottom: '20px',
                maxWidth: '400px'
              }}>
                <input
                  type="text"
                  placeholder="미팅 제목으로 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '16px',
                    backgroundColor: '#f8f9fa',
                    transition: 'all 0.3s ease'
                  }}
                />
              </div>

              {filteredMeetings.length > 0 ? (
                <div style={{
                  display: 'grid',
                  gap: '20px'
                }}>
                  {filteredMeetings.map((meeting) => (
                    <div
                      key={meeting._id}
                      style={{
                        padding: '20px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        backgroundColor: '#f8f9fa'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '10px'
                      }}>
                        <h4 style={{
                          margin: 0,
                          fontSize: '18px',
                          color: '#333'
                        }}>
                          {meeting.title}
                        </h4>
                        <span style={{
                          padding: '4px 8px',
                          backgroundColor: meeting.status === 'STARTED' ? '#28a745' : 
                                        meeting.status === 'SCHEDULED' ? '#ffc107' : '#6c757d',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}>
                          {meeting.status === 'STARTED' ? '진행중' : 
                           meeting.status === 'SCHEDULED' ? '예약됨' : '종료됨'}
                        </span>
                      </div>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '10px',
                        fontSize: '14px',
                        color: '#666'
                      }}>
                        <div>초대코드: <strong>{meeting.inviteCode}</strong></div>
                        <div>참가자: {meeting.participantCount}명</div>
                        <div>생성일: {formatDate(meeting.createdAt)}</div>
                        {meeting.schedule && (
                          <div>예약일: {formatDate(meeting.schedule)}</div>
                        )}
                      </div>
                      <button
                        onClick={() => router.push(`/prejoin/${meeting._id}`)}
                        style={{
                          marginTop: '15px',
                          padding: '8px 16px',
                          backgroundColor: meeting.status === 'STARTED' ? '#28a745' : '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        Join
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  color: '#666'
                }}>
                  <div style={{
                    fontSize: '48px',
                    marginBottom: '20px'
                  }}>
                    {searchQuery.trim() ? '🔍' : '📅'}
                  </div>
                  <p>
                    {searchQuery.trim() 
                      ? `"${searchQuery}"에 대한 검색 결과가 없습니다.`
                      : '참여한 미팅이 없습니다.'
                    }
                  </p>
                  {searchQuery.trim() && (
                    <button
                      onClick={() => setSearchQuery('')}
                      style={{
                        marginTop: '15px',
                        padding: '8px 16px',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      검색 초기화
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'join' && (
            <div>
              <div style={{
                maxWidth: '500px',
                margin: '0 auto',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '48px',
                  marginBottom: '20px'
                }}>
                  🔗
                </div>
                <h3 style={{
                  marginBottom: '20px',
                  color: '#333'
                }}>
                  초대코드로 미팅 참여
                </h3>
                <p style={{
                  marginBottom: '30px',
                  color: '#666'
                }}>
                  미팅 호스트로부터 받은 초대코드를 입력하세요.
                </p>
                <div style={{
                  display: 'flex',
                  gap: '10px',
                  marginBottom: '20px'
                }}>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="초대코드 입력"
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '16px'
                    }}
                  />
                  <button
                    onClick={handleJoinByCode}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#1976d2',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '16px'
                    }}
                  >
                    참여
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div>
              <div style={{
                maxWidth: '600px',
                margin: '0 auto'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '30px'
                }}>
                  <div style={{
                    position: 'relative',
                    marginRight: '20px'
                  }}>
                    {user?.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt="Profile"
                        style={{
                          width: '80px',
                          height: '80px',
                          borderRadius: '50%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        backgroundColor: '#ddd',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '32px',
                        color: '#666'
                      }}>
                        👤
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer'
                      }}
                    />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, marginBottom: '5px' }}>프로필 이미지</h3>
                    <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                      클릭하여 이미지 업로드
                    </p>
                    {user?.avatarUrl && (
                      <button
                        onClick={handleDeleteImage}
                        style={{
                          marginTop: '5px',
                          padding: '4px 8px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gap: '20px'
                }}>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '5px',
                      fontWeight: 'bold'
                    }}>
                      이름
                    </label>
                    <input
                      type="text"
                      value={profileData.displayName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, displayName: e.target.value }))}
                      disabled={!isEditingProfile}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '16px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '5px',
                      fontWeight: 'bold'
                    }}>
                      이메일
                    </label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '16px',
                        backgroundColor: '#f8f9fa',
                        color: '#666'
                      }}
                    />
                    <p style={{
                      margin: '5px 0 0 0',
                      fontSize: '12px',
                      color: '#666'
                    }}>
                      이메일은 변경할 수 없습니다.
                    </p>
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '5px',
                      fontWeight: 'bold'
                    }}>
                      부서
                    </label>
                    <input
                      type="text"
                      value={profileData.department}
                      onChange={(e) => setProfileData(prev => ({ ...prev, department: e.target.value }))}
                      disabled={!isEditingProfile}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '16px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '5px',
                      fontWeight: 'bold'
                    }}>
                      전화번호
                    </label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                      disabled={!isEditingProfile}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '16px'
                      }}
                    />
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: '10px',
                    marginTop: '20px'
                  }}>
                    {!isEditingProfile ? (
                      <button
                        onClick={() => setIsEditingProfile(true)}
                        style={{
                          padding: '12px 24px',
                          backgroundColor: '#1976d2',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '16px'
                        }}
                      >
                        편집
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handleUpdateProfile}
                          style={{
                            padding: '12px 24px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '16px'
                          }}
                        >
                          저장
                        </button>
                        <button
                          onClick={() => {
                            setIsEditingProfile(false);
                            setProfileData({
                              displayName: user?.displayName || '',
                              department: user?.department || '',
                              phone: user?.phone || ''
                            });
                          }}
                          style={{
                            padding: '12px 24px',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '16px'
                          }}
                        >
                          취소
                        </button>
                      </>
                    )}
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