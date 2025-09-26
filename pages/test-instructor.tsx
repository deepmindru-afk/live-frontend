import React, { useState, useEffect } from 'react';
import Head from 'next/head';

const TestInstructorPage = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addResult = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setTestResults(prev => [...prev, logEntry]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const testAuth = async () => {
    clearResults();
    addResult('🧪 Testing authentication...', 'info');
    
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        addResult('❌ No user found in localStorage', 'error');
        return;
      }
      
      const user = JSON.parse(userStr);
      addResult(`✅ User found: ${user.displayName || user.email}`, 'success');
      addResult(`📋 User ID: ${user._id}`, 'info');
      addResult(`📋 User Role: ${user.systemRole}`, 'info');
      
      const token = localStorage.getItem('token');
      if (!token) {
        addResult('❌ No token found in localStorage', 'error');
        return;
      }
      
      addResult('✅ Token found in localStorage', 'success');
      
    } catch (error: any) {
      addResult(`❌ Authentication test failed: ${error.message}`, 'error');
    }
  };

  const testGraphQLConnection = async () => {
    clearResults();
    addResult('🧪 Testing GraphQL connection...', 'info');
    
    try {
      const { makeGraphQLRequest } = await import('../../lib/simple-auth-handlers');
      
      const query = `
        query TestConnection {
          me {
            _id
            email
            displayName
            systemRole
          }
        }
      `;
      
      const result = await makeGraphQLRequest(query, {});
      addResult('✅ GraphQL connection successful', 'success');
      addResult(`📋 User data: ${JSON.stringify(result.me, null, 2)}`, 'info');
      
    } catch (error: any) {
      addResult(`❌ GraphQL connection failed: ${error.message}`, 'error');
    }
  };

  const testGetMeetings = async () => {
    clearResults();
    addResult('🧪 Testing getMeetings with hostId filter...', 'info');
    
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const currentUserId = user?._id;
      
      if (!currentUserId) {
        addResult('❌ No user ID found', 'error');
        return;
      }
      
      const { makeGraphQLRequest } = await import('../../lib/simple-auth-handlers');
      
      const query = `
        query GetMyMeetings($input: MeetingQueryInput!) {
          getMeetings(input: $input) {
            meetings {
              _id
              title
              status
              inviteCode
              participantCount
              createdAt
              host {
                _id
                email
                displayName
              }
            }
            total
            limit
            offset
            hasMore
          }
        }
      `;
      
      const result = await makeGraphQLRequest(query, {
        input: {
          hostId: currentUserId,
          limit: 50,
          page: 1
        }
      });
      
      addResult('✅ GetMeetings query successful', 'success');
      addResult(`📋 Response: ${JSON.stringify(result, null, 2)}`, 'info');
      
      if (result.getMeetings && result.getMeetings.meetings) {
        addResult(`📊 Found ${result.getMeetings.meetings.length} meetings`, 'success');
        
        result.getMeetings.meetings.forEach((meeting: any, index: number) => {
          addResult(`📋 Meeting ${index + 1}: ${meeting.title} (${meeting.status})`, 'info');
        });
      } else {
        addResult('⚠️ No meetings found in response', 'warning');
      }
      
    } catch (error: any) {
      addResult(`❌ GetMeetings query failed: ${error.message}`, 'error');
    }
  };

  const testGetMeetingsWithoutHostId = async () => {
    clearResults();
    addResult('🧪 Testing getMeetings without hostId filter...', 'info');
    
    try {
      const { makeGraphQLRequest } = await import('../../lib/simple-auth-handlers');
      
      const query = `
        query GetMyMeetings($input: MeetingQueryInput!) {
          getMeetings(input: $input) {
            meetings {
              _id
              title
              status
              inviteCode
              participantCount
              createdAt
              host {
                _id
                email
                displayName
              }
            }
            total
            limit
            offset
            hasMore
          }
        }
      `;
      
      const result = await makeGraphQLRequest(query, {
        input: {
          limit: 50,
          page: 1
        }
      });
      
      addResult('✅ GetMeetings query (no hostId) successful', 'success');
      addResult(`📋 Response: ${JSON.stringify(result, null, 2)}`, 'info');
      
      if (result.getMeetings && result.getMeetings.meetings) {
        addResult(`📊 Found ${result.getMeetings.meetings.length} meetings`, 'success');
        
        result.getMeetings.meetings.forEach((meeting: any, index: number) => {
          addResult(`📋 Meeting ${index + 1}: ${meeting.title} (${meeting.status}) - Host: ${meeting.host?.displayName || meeting.host?.email}`, 'info');
        });
      } else {
        addResult('⚠️ No meetings found in response', 'warning');
      }
      
    } catch (error: any) {
      addResult(`❌ GetMeetings query (no hostId) failed: ${error.message}`, 'error');
    }
  };

  const testCreateMeeting = async () => {
    clearResults();
    addResult('🧪 Testing createMeeting...', 'info');
    
    try {
      const { makeGraphQLRequest } = await import('../../lib/simple-auth-handlers');
      
      const mutation = `
        mutation CreateMeeting($input: CreateMeetingInput!) {
          createMeeting(input: $input) {
            _id
            title
            status
            inviteCode
            participantCount
            createdAt
          }
        }
      `;
      
      const result = await makeGraphQLRequest(mutation, {
        input: {
          title: `Test Meeting ${new Date().toISOString()}`,
          notes: 'Test meeting created from dashboard test',
          isPrivate: false,
          maxParticipants: 100
        }
      });
      
      addResult('✅ CreateMeeting mutation successful', 'success');
      addResult(`📋 Created meeting: ${JSON.stringify(result.createMeeting, null, 2)}`, 'info');
      
    } catch (error: any) {
      addResult(`❌ CreateMeeting mutation failed: ${error.message}`, 'error');
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <Head>
        <title>Test Instructor Dashboard</title>
      </Head>
      
      <h1>🔍 Test Instructor Dashboard</h1>
      <p>This tool tests the instructor dashboard meeting fetching functionality.</p>

      <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>🧪 Test Scenarios</h3>
        <button 
          onClick={testAuth}
          style={{ background: '#007bff', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', margin: '5px' }}
        >
          Test Authentication
        </button>
        <button 
          onClick={testGraphQLConnection}
          style={{ background: '#007bff', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', margin: '5px' }}
        >
          Test GraphQL Connection
        </button>
        <button 
          onClick={testGetMeetings}
          style={{ background: '#007bff', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', margin: '5px' }}
        >
          Test Get Meetings
        </button>
        <button 
          onClick={testGetMeetingsWithoutHostId}
          style={{ background: '#007bff', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', margin: '5px' }}
        >
          Test Get Meetings (No HostId)
        </button>
        <button 
          onClick={testCreateMeeting}
          style={{ background: '#007bff', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', margin: '5px' }}
        >
          Test Create Meeting
        </button>
      </div>

      <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>📊 Test Results</h3>
        <div style={{ background: '#f8f9fa', border: '1px solid #e9ecef', padding: '10px', borderRadius: '5px', fontFamily: 'monospace', fontSize: '12px', maxHeight: '300px', overflowY: 'auto', margin: '10px 0' }}>
          {testResults.length === 0 ? (
            <div style={{ color: '#17a2b8', fontWeight: 'bold' }}>Ready to run tests. Click any test button above.</div>
          ) : (
            testResults.map((result, index) => (
              <div key={index} style={{ marginBottom: '5px' }}>
                {result}
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>🔧 Debugging Steps</h3>
        <ol>
          <li><strong>Check Authentication:</strong> Verify user is logged in and has valid token</li>
          <li><strong>Check GraphQL Connection:</strong> Verify backend is responding</li>
          <li><strong>Check Meeting Query:</strong> Test with and without hostId filter</li>
          <li><strong>Check User ID:</strong> Verify the user ID being used for filtering</li>
          <li><strong>Check Backend Logs:</strong> Look for any errors in the backend console</li>
        </ol>
      </div>
    </div>
  );
};

export default TestInstructorPage;
