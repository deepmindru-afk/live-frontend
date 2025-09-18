// Test the mock GraphQL service directly
const { enhancedMakeGraphQLRequest } = require('./lib/mock-graphql-service.ts');

async function testMockService() {
  console.log('🧪 Testing Mock GraphQL Service...\n');

  try {
    // Test 1: Health query (should go to real backend)
    console.log('1. Testing health query (real backend)...');
    try {
      const healthResult = await enhancedMakeGraphQLRequest(`
        query TestQuery {
          health
        }
      `);
      console.log('✅ Health query result:', healthResult);
    } catch (error) {
      console.log('❌ Health query failed:', error.message);
    }

    // Test 2: Create meeting (should use mock service)
    console.log('\n2. Testing createMeeting (mock service)...');
    try {
      const createResult = await enhancedMakeGraphQLRequest(`
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
      `, {
        input: {
          title: 'Test Meeting',
          scheduledStartAt: null,
          isPrivate: false,
          notes: 'Test meeting created by mock service'
        }
      });
      console.log('✅ Create Meeting Result:', createResult);
    } catch (error) {
      console.log('❌ Create Meeting failed:', error.message);
    }

    // Test 3: Fetch meetings (should use mock service)
    console.log('\n3. Testing meetings query (mock service)...');
    try {
      const meetingsResult = await enhancedMakeGraphQLRequest(`
        query GetMyMeetings {
          meetings {
            _id
            title
            status
            inviteCode
            createdAt
          }
        }
      `);
      console.log('✅ Meetings Query Result:', meetingsResult);
    } catch (error) {
      console.log('❌ Meetings Query failed:', error.message);
    }

    // Test 4: Start meeting (should use mock service)
    console.log('\n4. Testing startMeeting (mock service)...');
    try {
      const startResult = await enhancedMakeGraphQLRequest(`
        mutation StartMeeting($meetingId: ID!) {
          startMeeting(meetingId: $meetingId) {
            success
            message
            meeting {
              _id
              title
              status
              inviteCode
            }
          }
        }
      `, {
        meetingId: 'mock-1'
      });
      console.log('✅ Start Meeting Result:', startResult);
    } catch (error) {
      console.log('❌ Start Meeting failed:', error.message);
    }

    console.log('\n🎉 Mock service tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMockService();


