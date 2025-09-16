// Test script to verify the meeting creation API
const fetch = require('node-fetch');

const GRAPHQL_ENDPOINT = 'http://localhost:3007/graphql';

async function testBackendHealth() {
  try {
    console.log('🔍 Testing backend health...');
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'query { health }' })
    });
    
    const data = await response.json();
    console.log('✅ Backend is running:', data.data.health ? 'Yes' : 'No');
    return true;
  } catch (error) {
    console.log('❌ Backend is not accessible:', error.message);
    return false;
  }
}

async function testMeetingMutations() {
  try {
    console.log('🔍 Testing meeting mutations...');
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            __schema {
              mutationType {
                fields {
                  name
                }
              }
            }
          }
        `
      })
    });
    
    const data = await response.json();
    const mutations = data.data.__schema.mutationType.fields.map(f => f.name);
    
    console.log('📋 Available mutations:', mutations);
    
    const meetingMutations = mutations.filter(m => m.toLowerCase().includes('meeting'));
    console.log('🏠 Meeting-related mutations:', meetingMutations);
    
    if (meetingMutations.length === 0) {
      console.log('❌ No meeting mutations found in backend');
      return false;
    } else {
      console.log('✅ Meeting mutations found in backend');
      return true;
    }
  } catch (error) {
    console.log('❌ Error testing mutations:', error.message);
    return false;
  }
}

async function testCreateMeeting() {
  try {
    console.log('🔍 Testing createMeeting mutation...');
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation CreateMeeting($input: CreateMeetingInput!) {
            createMeeting(input: $input) {
              success
              message
              meeting {
                _id
                title
                status
                inviteCode
                createdAt
              }
            }
          }
        `,
        variables: {
          input: {
            title: 'Test Meeting',
            scheduledStartAt: null,
            isPrivate: false,
            notes: 'Test meeting'
          }
        }
      })
    });
    
    const data = await response.json();
    console.log('📊 CreateMeeting response:', JSON.stringify(data, null, 2));
    
    if (data.errors) {
      console.log('❌ CreateMeeting failed:', data.errors[0].message);
      return false;
    } else {
      console.log('✅ CreateMeeting succeeded');
      return true;
    }
  } catch (error) {
    console.log('❌ Error testing createMeeting:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Starting API Tests...\n');
  
  const backendHealthy = await testBackendHealth();
  console.log('');
  
  if (backendHealthy) {
    const hasMeetingMutations = await testMeetingMutations();
    console.log('');
    
    if (hasMeetingMutations) {
      await testCreateMeeting();
    } else {
      console.log('ℹ️  Backend has no meeting mutations - frontend will use mock service');
    }
  }
  
  console.log('\n🏁 Tests completed!');
}

runTests();
