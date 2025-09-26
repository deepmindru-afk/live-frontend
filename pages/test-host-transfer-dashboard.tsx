import React, { useState } from 'react';
import Head from 'next/head';

const TestHostTransferDashboardPage = () => {
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

  const testHostTransferLogic = async () => {
    clearResults();
    addResult('🧪 Testing host transfer dashboard logic...', 'info');
    
    try {
      const { makeGraphQLRequest } = await import('../../lib/simple-auth-handlers');
      const { GET_MY_MEETINGS } = await import('../../apollo/meeting/queries');
      
      // Get current user
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      
      if (!user) {
        addResult('❌ No user found - please log in first', 'error');
        return;
      }
      
      addResult(`✅ User found: ${user.displayName || user.email}`, 'success');
      addResult(`📋 User ID: ${user._id}`, 'info');
      
      // Test with hostId filter
      const result = await makeGraphQLRequest(GET_MY_MEETINGS, {
        input: {
          hostId: user._id,
          limit: 50,
          page: 1
        }
      });
      
      addResult('✅ Meeting query successful', 'success');
      
      if (result.getMeetings && result.getMeetings.meetings) {
        addResult(`📊 Found ${result.getMeetings.meetings.length} meetings`, 'success');
        
        result.getMeetings.meetings.forEach((meeting: any, index: number) => {
          // Check if current user is still the host of this meeting
          const isCurrentUserHost = meeting.hostId === user._id || 
                                  (meeting.host && meeting.host._id === user._id);
          
          // Determine status based on whether user is still host
          let status: 'LIVE' | 'STARTED' | 'SCHEDULED' | 'ENDED';
          if (isCurrentUserHost) {
            // User is still the host, show actual meeting status
            status = meeting.status === 'LIVE' ? 'LIVE' :
                    meeting.status === 'CREATED' ? 'LIVE' : 
                    meeting.status === 'SCHEDULED' ? 'SCHEDULED' : 
                    meeting.status === 'ENDED' ? 'ENDED' : 'LIVE';
          } else {
            // User is no longer the host (transferred), show as ENDED
            status = 'ENDED';
          }
          
          addResult(`📋 Meeting ${index + 1}: ${meeting.title}`, 'info');
          addResult(`   - Original Status: ${meeting.status}`, 'info');
          addResult(`   - Host ID: ${meeting.hostId}`, 'info');
          addResult(`   - Is Current User Host: ${isCurrentUserHost}`, 'info');
          addResult(`   - Final Status: ${status}`, 'info');
          addResult(`   - Should show in: ${status === 'ENDED' ? 'ENDED' : status} tab`, 'info');
        });
      } else {
        addResult('⚠️ No meetings found', 'warning');
      }
      
    } catch (error: any) {
      addResult(`❌ Test failed: ${error.message}`, 'error');
    }
  };

  const testWithoutHostIdFilter = async () => {
    clearResults();
    addResult('🧪 Testing without hostId filter (all meetings)...', 'info');
    
    try {
      const { makeGraphQLRequest } = await import('../../lib/simple-auth-handlers');
      const { GET_MY_MEETINGS } = await import('../../apollo/meeting/queries');
      
      // Get current user
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      
      if (!user) {
        addResult('❌ No user found - please log in first', 'error');
        return;
      }
      
      // Test without hostId filter to see all meetings
      const result = await makeGraphQLRequest(GET_MY_MEETINGS, {
        input: {
          limit: 50,
          page: 1
        }
      });
      
      addResult('✅ Meeting query (no hostId filter) successful', 'success');
      
      if (result.getMeetings && result.getMeetings.meetings) {
        addResult(`📊 Found ${result.getMeetings.meetings.length} meetings`, 'success');
        
        result.getMeetings.meetings.forEach((meeting: any, index: number) => {
          // Check if current user is still the host of this meeting
          const isCurrentUserHost = meeting.hostId === user._id || 
                                  (meeting.host && meeting.host._id === user._id);
          
          // Determine status based on whether user is still host
          let status: 'LIVE' | 'STARTED' | 'SCHEDULED' | 'ENDED';
          if (isCurrentUserHost) {
            // User is still the host, show actual meeting status
            status = meeting.status === 'LIVE' ? 'LIVE' :
                    meeting.status === 'CREATED' ? 'LIVE' : 
                    meeting.status === 'SCHEDULED' ? 'SCHEDULED' : 
                    meeting.status === 'ENDED' ? 'ENDED' : 'LIVE';
          } else {
            // User is no longer the host (transferred), show as ENDED
            status = 'ENDED';
          }
          
          addResult(`📋 Meeting ${index + 1}: ${meeting.title}`, 'info');
          addResult(`   - Original Status: ${meeting.status}`, 'info');
          addResult(`   - Host ID: ${meeting.hostId}`, 'info');
          addResult(`   - Host Name: ${meeting.host?.displayName || meeting.host?.email || 'Unknown'}`, 'info');
          addResult(`   - Is Current User Host: ${isCurrentUserHost}`, 'info');
          addResult(`   - Final Status: ${status}`, 'info');
          addResult(`   - Should show in: ${status === 'ENDED' ? 'ENDED' : status} tab`, 'info');
        });
      } else {
        addResult('⚠️ No meetings found', 'warning');
      }
      
    } catch (error: any) {
      addResult(`❌ Test failed: ${error.message}`, 'error');
    }
  };

  const runAllTests = async () => {
    setIsLoading(true);
    clearResults();
    
    addResult('🚀 Running all host transfer dashboard tests...', 'info');
    
    await testHostTransferLogic();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testWithoutHostIdFilter();
    
    addResult('✅ All tests completed!', 'success');
    setIsLoading(false);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <Head>
        <title>Test Host Transfer Dashboard</title>
      </Head>
      
      <h1>🔍 Test Host Transfer Dashboard</h1>
      <p>This page tests the host transfer dashboard functionality to ensure transferred meetings show in the ENDED section.</p>

      <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>🧪 Test Scenarios</h3>
        <button 
          onClick={testHostTransferLogic}
          disabled={isLoading}
          style={{ background: '#007bff', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', margin: '5px' }}
        >
          Test Host Transfer Logic
        </button>
        <button 
          onClick={testWithoutHostIdFilter}
          disabled={isLoading}
          style={{ background: '#007bff', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', margin: '5px' }}
        >
          Test All Meetings
        </button>
        <button 
          onClick={runAllTests}
          disabled={isLoading}
          style={{ background: '#28a745', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', margin: '5px' }}
        >
          Run All Tests
        </button>
      </div>

      <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>📊 Test Results</h3>
        <div style={{ background: '#f8f9fa', border: '1px solid #e9ecef', padding: '10px', borderRadius: '5px', fontFamily: 'monospace', fontSize: '12px', maxHeight: '500px', overflowY: 'auto', margin: '10px 0' }}>
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
        <h3>🔧 Expected Behavior</h3>
        <ol>
          <li><strong>If user is still the host:</strong> Meeting shows with actual status (LIVE, SCHEDULED, ENDED)</li>
          <li><strong>If user is no longer the host:</strong> Meeting shows as ENDED regardless of actual status</li>
          <li><strong>Transferred meetings:</strong> Should appear in ENDED section with "이전됨" indicator</li>
          <li><strong>Action buttons:</strong> Transferred meetings should show "이전됨" button (disabled)</li>
        </ol>
      </div>

      <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>🧪 Test Links</h3>
        <ul>
          <li><a href="/instructor" target="_blank">Instructor Dashboard</a></li>
          <li><a href="/debug-instructor" target="_blank">Debug Instructor</a></li>
          <li><a href="/test-fixes" target="_blank">Test Fixes</a></li>
        </ul>
      </div>
    </div>
  );
};

export default TestHostTransferDashboardPage;
