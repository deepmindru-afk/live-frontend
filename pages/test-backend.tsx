import React, { useState } from 'react';
import Head from 'next/head';

const TestBackendPage = () => {
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

  const testBackendConnection = async () => {
    clearResults();
    addResult('🧪 Testing backend connection...', 'info');
    
    try {
      const response = await fetch('http://localhost:3007/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query TestConnection {
              me {
                _id
                email
                displayName
                systemRole
              }
            }
          `
        })
      });

      if (!response.ok) {
        addResult(`❌ Backend connection failed: ${response.status} ${response.statusText}`, 'error');
        return;
      }

      const data = await response.json();
      addResult('✅ Backend connection successful', 'success');
      addResult(`📋 Response: ${JSON.stringify(data, null, 2)}`, 'info');
      
    } catch (error: any) {
      addResult(`❌ Backend connection failed: ${error.message}`, 'error');
    }
  };

  const testGraphQLRequest = async () => {
    clearResults();
    addResult('🧪 Testing GraphQL request function...', 'info');
    
    try {
      const { makeGraphQLRequest } = await import('../../lib/simple-auth-handlers');
      
      if (!makeGraphQLRequest) {
        addResult('❌ makeGraphQLRequest function not found', 'error');
        return;
      }
      
      addResult('✅ makeGraphQLRequest function found', 'success');
      
      const query = `
        query TestQuery {
          me {
            _id
            email
            displayName
            systemRole
          }
        }
      `;
      
      const result = await makeGraphQLRequest(query, {});
      addResult('✅ GraphQL request successful', 'success');
      addResult(`📋 Result: ${JSON.stringify(result, null, 2)}`, 'info');
      
    } catch (error: any) {
      addResult(`❌ GraphQL request failed: ${error.message}`, 'error');
    }
  };

  const testMeetingQuery = async () => {
    clearResults();
    addResult('🧪 Testing meeting query...', 'info');
    
    try {
      const { makeGraphQLRequest } = await import('../../lib/simple-auth-handlers');
      const { GET_MY_MEETINGS } = await import('../../apollo/meeting/queries');
      
      const result = await makeGraphQLRequest(GET_MY_MEETINGS, {
        input: {
          limit: 50,
          page: 1
        }
      });
      
      addResult('✅ Meeting query successful', 'success');
      addResult(`📋 Result: ${JSON.stringify(result, null, 2)}`, 'info');
      
      if (result.getMeetings && result.getMeetings.meetings) {
        addResult(`📊 Found ${result.getMeetings.meetings.length} meetings`, 'success');
      } else {
        addResult('⚠️ No meetings found in response', 'warning');
      }
      
    } catch (error: any) {
      addResult(`❌ Meeting query failed: ${error.message}`, 'error');
    }
  };

  const testCreateMeeting = async () => {
    clearResults();
    addResult('🧪 Testing create meeting...', 'info');
    
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
          notes: 'Test meeting created from backend test',
          isPrivate: false,
          maxParticipants: 100
        }
      });
      
      addResult('✅ Create meeting successful', 'success');
      addResult(`📋 Created meeting: ${JSON.stringify(result.createMeeting, null, 2)}`, 'info');
      
    } catch (error: any) {
      addResult(`❌ Create meeting failed: ${error.message}`, 'error');
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <Head>
        <title>Test Backend Connection</title>
      </Head>
      
      <h1>🔍 Test Backend Connection</h1>
      <p>This tool tests the backend connection and GraphQL functionality.</p>

      <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>🧪 Test Scenarios</h3>
        <button 
          onClick={testBackendConnection}
          disabled={isLoading}
          style={{ background: '#007bff', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', margin: '5px' }}
        >
          Test Backend Connection
        </button>
        <button 
          onClick={testGraphQLRequest}
          disabled={isLoading}
          style={{ background: '#007bff', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', margin: '5px' }}
        >
          Test GraphQL Request
        </button>
        <button 
          onClick={testMeetingQuery}
          disabled={isLoading}
          style={{ background: '#007bff', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', margin: '5px' }}
        >
          Test Meeting Query
        </button>
        <button 
          onClick={testCreateMeeting}
          disabled={isLoading}
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
        <h3>🔧 Troubleshooting</h3>
        <ol>
          <li><strong>Backend not responding:</strong> Make sure the backend server is running on port 3007</li>
          <li><strong>GraphQL errors:</strong> Check backend logs for any errors</li>
          <li><strong>Authentication errors:</strong> Make sure you're logged in</li>
          <li><strong>No meetings found:</strong> Create a test meeting first</li>
        </ol>
      </div>
    </div>
  );
};

export default TestBackendPage;
