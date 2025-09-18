import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const MeetingPage: React.FC = () => {
  const router = useRouter();
  const { meetingId } = router.query;
  const [meeting, setMeeting] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (meetingId) {
      // Simulate meeting data
      setMeeting({
        _id: meetingId,
        title: 'Test Meeting',
        status: 'STARTED',
        inviteCode: 'ABC123'
      });
      setLoading(false);
    }
  }, [meetingId]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px'
      }}>
        미팅을 로딩 중...
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>미팅 - {meeting?.title}</title>
        <meta name="description" content="가상 미팅 참여" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{
        minHeight: '100vh',
        backgroundColor: '#1a1a1a',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <h1 style={{ marginBottom: '20px' }}>미팅 참여</h1>
        <div style={{
          backgroundColor: '#333',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h2>{meeting?.title}</h2>
          <p>미팅 ID: {meeting?._id}</p>
          <p>초대코드: {meeting?.inviteCode}</p>
          <p>상태: {meeting?.status}</p>
        </div>
        <button
          onClick={() => router.push('/waiting')}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          대기실로 돌아가기
        </button>
      </div>
    </>
  );
};

export default MeetingPage;

