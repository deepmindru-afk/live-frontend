import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { enhancedMakeGraphQLRequest } from '../../lib/mock-graphql-service';
import { GET_VODS } from '../../apollo/vod/queries';
import { CREATE_VOD, UPDATE_VOD, DELETE_VOD, UPLOAD_VOD_FILE, CREATE_VOD_FROM_URL } from '../../apollo/vod/mutations';
import Swal from 'sweetalert2';

interface VOD {
  _id: string;
  title: string;
  meetingId?: string;
  source?: string;
  storageKey?: string;
  sizeBytes?: number;
  durationSec?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  meeting?: {
    _id: string;
    title: string;
    status: string;
    inviteCode: string;
  };
}

const VODPage: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [vods, setVods] = useState<VOD[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showURLModal, setShowURLModal] = useState(false);
  const [uploadType, setUploadType] = useState<'file' | 'url'>('file');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [urlTitle, setUrlTitle] = useState('');
  const [showVODMenu, setShowVODMenu] = useState<string | null>(null);
  const [selectedVOD, setSelectedVOD] = useState<VOD | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadVODs();
    }
  }, [user]);

  const checkAuth = async () => {
    try {
      // Check if user is authenticated
      const token = localStorage.getItem('jwt');
      if (!token) {
        router.push('/login');
        return;
      }

      // Get user data
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      setUser(userData);
    } catch (error) {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const loadVODs = async () => {
    try {
      const result = await enhancedMakeGraphQLRequest(GET_VODS, {
        input: { limit: 50, offset: 0 }
      });
      
      if (result.getAllVods && result.getAllVods.vods) {
        setVods(result.getAllVods.vods);
      }
    } catch (error) {
      // Mock VOD data with new schema
      setVods([
        {
          _id: 'vod-1',
          title: 'Sample VOD 1',
          sizeBytes: 1024000000, // 1GB
          durationSec: 3600, // 1 hour
          source: 'FILE',
          storageKey: 'vod-1.mp4',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          meeting: {
            _id: 'meeting-1',
            title: 'Sample Meeting 1',
            status: 'ENDED',
            inviteCode: 'ABC123'
          }
        },
        {
          _id: 'vod-2',
          title: 'Sample VOD 2',
          sizeBytes: 512000000, // 512MB
          durationSec: 1800, // 30 minutes
          source: 'URL',
          storageKey: 'https://example.com/vod2.mp4',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          meeting: {
            _id: 'meeting-2',
            title: 'Sample Meeting 2',
            status: 'ENDED',
            inviteCode: 'DEF456'
          }
        }
      ]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileUpload = () => {
    setUploadType('file');
    setShowUploadModal(true);
  };

  const handleURLUpload = () => {
    setUploadType('url');
    setShowURLModal(true);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const uploadFile = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const result = await enhancedMakeGraphQLRequest(UPLOAD_VOD_FILE, {
        input: {
          title: selectedFile.name,
          notes: 'Uploaded via VOD page'
        },
        file: selectedFile
      });

      if (result.uploadVodFile && result.uploadVodFile.success) {
        await Swal.fire({
          icon: 'success',
          title: '파일 업로드',
          text: 'VOD 파일이 성공적으로 업로드되었습니다.',
          timer: 2000,
          showConfirmButton: false
        });
        
        setShowUploadModal(false);
        setSelectedFile(null);
        loadVODs();
      }
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: '업로드 실패',
        text: '파일 업로드 중 오류가 발생했습니다.',
        confirmButtonText: '확인'
      });
    } finally {
      setUploading(false);
    }
  };

  const uploadFromURL = async () => {
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
          notes: 'Created from URL via VOD page'
        }
      });

      if (result.createVodFromUrl && result.createVodFromUrl.success) {
        await Swal.fire({
          icon: 'success',
          title: 'URL 등록',
          text: 'VOD URL이 성공적으로 등록되었습니다.',
          timer: 2000,
          showConfirmButton: false
        });
        
        setShowURLModal(false);
        setUrlInput('');
        setUrlTitle('');
        loadVODs();
      }
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: '등록 실패',
        text: 'URL 등록 중 오류가 발생했습니다.',
        confirmButtonText: '확인'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleVODMenuClick = (vodId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const vod = vods.find(v => v._id === vodId);
    if (vod) {
      setSelectedVOD(vod);
      setShowVODMenu(vodId);
    }
  };

  const closeVODMenu = () => {
    setShowVODMenu(null);
    setSelectedVOD(null);
  };

  const deleteVOD = async (vodId: string) => {
    const vod = vods.find(v => v._id === vodId);
    if (!vod) return;

    const result = await Swal.fire({
      title: 'VOD 삭제',
      text: `"${vod.title}"을(를) 삭제하시겠습니까?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '삭제',
      cancelButtonText: '취소',
      confirmButtonColor: '#dc3545'
    });

    if (result.isConfirmed) {
      try {
        await enhancedMakeGraphQLRequest(DELETE_VOD, { vodId: vodId });
        
        await Swal.fire({
          icon: 'success',
          title: '삭제 완료',
          text: 'VOD가 성공적으로 삭제되었습니다.',
          timer: 2000,
          showConfirmButton: false
        });
        
        loadVODs();
      } catch (error) {
        await Swal.fire({
          icon: 'error',
          title: '삭제 실패',
          text: 'VOD 삭제 중 오류가 발생했습니다.',
          confirmButtonText: '확인'
        });
      }
    }
    closeVODMenu();
  };

  const filteredVODs = vods.filter(vod =>
    vod.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <title>VOD 관리 - HRDe Live</title>
        <meta name="description" content="VOD 관리 및 업로드" />
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
            marginBottom: '40px'
          }}>
            <h1 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              margin: 0,
              color: '#333'
            }}>
              Meet: <span style={{ color: '#4285f4' }}>mate</span>
            </h1>
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
              {user?.displayName || 'member1'}님, 안녕하세요 👋
            </h2>
          </div>

          {/* Create Room Section */}
          <div style={{
            backgroundColor: '#e3f2fd',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '20px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '15px'
            }}>
              <span style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: 'white',
                marginRight: '8px'
              }}>
                방 만들기
              </span>
              <span style={{
                fontSize: '18px',
                color: 'white'
              }}>
                +
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <input
                type="text"
                placeholder="방 이름을 입력하세요"
                style={{
                  flex: 1,
                  padding: '10px',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
              <button
                onClick={() => router.push('/dashboard')}
                style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: '#1976d2',
                  border: 'none',
                  borderRadius: '50%',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px'
                }}
              >
                →
              </button>
            </div>
          </div>

          {/* Schedule Section */}
          <div style={{
            backgroundColor: '#f3e5f5',
            padding: '20px',
            borderRadius: '12px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '15px'
            }}>
              <span style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: 'white',
                marginRight: '8px'
              }}>
                예약하기
              </span>
              <span style={{
                fontSize: '18px',
                color: 'white'
              }}>
                Ⓒ
              </span>
            </div>
            <p style={{
              fontSize: '14px',
              color: 'white',
              margin: '0 0 15px 0'
            }}>
              원하는 시간에 회의를 할 수 있습니다
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: '#7b1fa2',
                border: 'none',
                borderRadius: '50%',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                marginLeft: 'auto'
              }}
            >
              →
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
            <div></div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px'
            }}>
              <span style={{
                fontSize: '16px',
                color: '#333'
              }}>
                {user?.displayName || 'member1'}님
              </span>
              <span style={{
                color: '#ddd'
              }}>|</span>
              <button
                onClick={() => {
                  localStorage.removeItem('jwt');
                  localStorage.removeItem('user');
                  router.push('/login');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#333',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '16px'
                }}
              >
                로그아웃
                <span style={{ fontSize: '18px' }}>↻</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{
            display: 'flex',
            gap: '30px',
            marginBottom: '30px',
            borderBottom: '1px solid #eee'
          }}>
            {[
              { id: 'started', label: '시작된 회의' },
              { id: 'scheduled', label: '예약된 회의' },
              { id: 'ended', label: '종료된 회의' },
              { id: 'vod', label: 'VOD 관리' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'vod') return;
                  router.push('/dashboard');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '15px 0',
                  fontSize: '16px',
                  color: tab.id === 'vod' ? '#1976d2' : '#666',
                  borderBottom: tab.id === 'vod' ? '2px solid #1976d2' : '2px solid transparent',
                  cursor: tab.id === 'vod' ? 'default' : 'pointer',
                  fontWeight: tab.id === 'vod' ? 'bold' : 'normal'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* VOD Management Section */}
          <div>
            {/* Upload Options */}
            <div style={{
              display: 'flex',
              gap: '15px',
              marginBottom: '30px'
            }}>
              <button
                onClick={handleFileUpload}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'white',
                  border: '2px solid #1976d2',
                  borderRadius: '8px',
                  color: '#1976d2',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '16px',
                  fontWeight: '500'
                }}
              >
                📁 파일 등록
              </button>
              <button
                onClick={handleURLUpload}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'white',
                  border: '2px solid #1976d2',
                  borderRadius: '8px',
                  color: '#1976d2',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '16px',
                  fontWeight: '500'
                }}
              >
                🔗 URL 등록
              </button>
            </div>

            {/* Search Bar */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: '20px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <input
                  type="text"
                  placeholder="검색어를 입력하세요"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    padding: '10px 15px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '14px',
                    width: '250px'
                  }}
                />
                <button
                  style={{
                    padding: '10px',
                    backgroundColor: '#1976d2',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  🔍
                </button>
              </div>
            </div>

            {/* VOD Table */}
            {filteredVODs.length > 0 ? (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>No.</th>
                      <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>VOD 제목</th>
                      <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>용량</th>
                      <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVODs.map((vod, index) => (
                      <tr
                        key={vod._id}
                        style={{
                          borderBottom: '1px solid #dee2e6',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                      >
                        <td style={{ padding: '15px' }}>{index + 1}</td>
                        <td style={{ padding: '15px' }}>
                          <div>
                            <div style={{ fontWeight: '500', marginBottom: '4px' }}>{vod.title}</div>
                            <div style={{ fontSize: '14px', color: '#666' }}>
                              {vod.durationSec && formatDuration(vod.durationSec)}
                              {vod.meeting && ` • ${vod.meeting.title}`}
                              {vod.source === 'FILE' && ' (파일)'}
                              {vod.source === 'URL' && ' (URL)'}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '15px' }}>{vod.sizeBytes ? formatFileSize(vod.sizeBytes) : 'N/A'}</td>
                        <td style={{ padding: '15px' }}>
                          <button
                            onClick={(e) => handleVODMenuClick(vod._id, e)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '18px',
                              color: '#6c757d'
                            }}
                          >
                            ⋯
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Empty State */
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  <span style={{ fontSize: '40px', color: '#6c757d' }}>✕</span>
                </div>
                <p style={{
                  fontSize: '18px',
                  color: '#6c757d',
                  margin: 0
                }}>
                  등록된 VOD가 없습니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* File Upload Modal */}
      {showUploadModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h2 style={{ margin: '0 0 20px 0' }}>파일 업로드</h2>
            <div style={{ marginBottom: '20px' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%',
                  padding: '20px',
                  border: '2px dashed #ddd',
                  borderRadius: '8px',
                  backgroundColor: '#f8f9fa',
                  cursor: 'pointer',
                  fontSize: '16px',
                  color: '#666'
                }}
              >
                {selectedFile ? selectedFile.name : '파일을 선택하세요'}
              </button>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                onClick={() => setShowUploadModal(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              <button
                onClick={uploadFile}
                disabled={!selectedFile || uploading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: uploading ? '#ccc' : '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: uploading ? 'not-allowed' : 'pointer'
                }}
              >
                {uploading ? '업로드 중...' : '업로드'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* URL Upload Modal */}
      {showURLModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h2 style={{ margin: '0 0 20px 0' }}>URL 등록</h2>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                VOD 제목
              </label>
              <input
                type="text"
                value={urlTitle}
                onChange={(e) => setUrlTitle(e.target.value)}
                placeholder="VOD 제목을 입력하세요"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  marginBottom: '15px'
                }}
              />
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                URL
              </label>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="VOD URL을 입력하세요"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                onClick={() => setShowURLModal(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              <button
                onClick={uploadFromURL}
                disabled={uploading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: uploading ? '#ccc' : '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: uploading ? 'not-allowed' : 'pointer'
                }}
              >
                {uploading ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOD Menu Dropdown */}
      {showVODMenu && selectedVOD && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2000
        }} onClick={closeVODMenu}>
          <div style={{
            position: 'absolute',
            top: '100px',
            left: '50px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            padding: '8px 0',
            minWidth: '200px',
            zIndex: 2001
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #eee',
              fontSize: '14px',
              fontWeight: '500',
              color: '#333'
            }}>
              {selectedVOD.title}
            </div>
            
            <button
              onClick={() => deleteVOD(selectedVOD._id)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                backgroundColor: 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#dc3545',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span>🗑️</span>
              삭제
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default VODPage;


