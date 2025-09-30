import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/router';
import Swal from 'sweetalert2';

// This is a minimal test component to verify JSX structure
const ProfessionalLiveStreamRoom = memo(() => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('participants');
  
  return (
    <>
      <div style={{
        display: 'flex',
        height: '100vh',
        backgroundColor: '#f8f9fa',
        color: '#1a1a1a',
        fontFamily: 'Arial, sans-serif',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '60px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          zIndex: 1000
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#007bff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '18px'
            }}>
              N
            </div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1a1a1a' }}>
                Demo Meeting
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                ID: DEMO123
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#dc3545'
              }}></div>
              Stopped
            </button>
            
            <button style={{
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}>
              Start
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{
          flex: 1,
          paddingTop: '60px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Thumbnails Row */}
          <div style={{
            height: '120px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            gap: '15px',
            overflowX: 'auto'
          }}>
            {/* Host Thumbnail */}
            <div style={{
              minWidth: '80px',
              height: '80px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '2px solid #007bff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                top: '-8px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: '#007bff',
                color: 'white',
                fontSize: '10px',
                fontWeight: 'bold',
                padding: '2px 6px',
                borderRadius: '4px'
              }}>
                HOST
              </div>
              <div style={{ fontSize: '24px' }}>👨‍🏫</div>
              <div style={{ fontSize: '12px', fontWeight: '500' }}>Host</div>
            </div>
          </div>

          {/* Main Stage */}
          <div style={{
            flex: 1,
            backgroundColor: '#1a1a1a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}>
            <div style={{
              width: '300px',
              height: '300px',
              borderRadius: '50%',
              backgroundColor: '#2d2d2d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '80px',
              color: '#666'
            }}>
              👨‍🏫
            </div>
          </div>

          {/* Bottom Control Bar */}
          <div style={{
            height: '80px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#007bff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '18px'
              }}>
                N
              </div>
              <div style={{ fontSize: '16px', fontWeight: '500' }}>1</div>
              <button style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#f8f9fa',
                border: '1px solid #e0e0e0',
                cursor: 'pointer',
                fontSize: '18px'
              }}>🎤</button>
              <button style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#f8f9fa',
                border: '1px solid #e0e0e0',
                cursor: 'pointer',
                fontSize: '18px'
              }}>📹</button>
              <button style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#f8f9fa',
                border: '1px solid #e0e0e0',
                cursor: 'pointer',
                fontSize: '18px'
              }}>📺</button>
              <button style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#f8f9fa',
                border: '1px solid #e0e0e0',
                cursor: 'pointer',
                fontSize: '18px'
              }}>💬</button>
              <button style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#f8f9fa',
                border: '1px solid #e0e0e0',
                cursor: 'pointer',
                fontSize: '18px'
              }}>👥</button>
            </div>
            <button style={{
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}>
              📞 Leave
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      {sidebarOpen && (
        <div style={{
          position: 'fixed',
          right: 0,
          top: '180px',
          width: '350px',
          height: 'calc(100vh - 280px)',
          backgroundColor: '#ffffff',
          borderLeft: '1px solid #e0e0e0',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
              Participants & Waiting Room
            </h3>
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                backgroundColor: 'transparent',
                color: '#666',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '0',
                width: '24px',
                height: '24px'
              }}
            >
              ×
            </button>
          </div>
          
          <div style={{
            display: 'flex',
            borderBottom: '1px solid #e0e0e0'
          }}>
            <button
              onClick={() => setActiveTab('participants')}
              style={{
                flex: 1,
                padding: '12px',
                border: 'none',
                backgroundColor: activeTab === 'participants' ? '#007bff' : 'transparent',
                color: activeTab === 'participants' ? 'white' : '#666',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Active Students (1)
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              style={{
                flex: 1,
                padding: '12px',
                border: 'none',
                backgroundColor: activeTab === 'chat' ? '#007bff' : 'transparent',
                color: activeTab === 'chat' ? 'white' : '#666',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Chat (0)
            </button>
          </div>
          
          <div style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
            {activeTab === 'participants' && (
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  marginBottom: '8px'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: '#e9ecef',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px'
                  }}>
                    👨‍🏫
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '2px' }}>
                      Host
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      host@demo.com
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ fontSize: '16px' }}>🎤</div>
                    <div style={{ fontSize: '16px' }}>📹</div>
                    <button style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '16px'
                    }}>
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'chat' && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
              }}>
                <div style={{ flex: 1, fontSize: '14px', color: '#666' }}>
                  No messages yet
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
});

ProfessionalLiveStreamRoom.displayName = 'ProfessionalLiveStreamRoom';

export default ProfessionalLiveStreamRoom;

