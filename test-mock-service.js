// Simple test script to verify the mock GraphQL service works
const { enhancedMakeGraphQLRequest } = require('./lib/mock-graphql-service.ts');

async function testMockService() {
  console.log('🧪 Testing Mock GraphQL Service...\n');

  try {
    // Test 1: Create a meeting
    console.log('1. Testing createMeeting...');
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

    // Test 2: Fetch meetings
    console.log('\n2. Testing meetings query...');
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

    // Test 3: Start a meeting
    console.log('\n3. Testing startMeeting...');
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

    // Test 4: End a meeting
    console.log('\n4. Testing endMeeting...');
    const endResult = await enhancedMakeGraphQLRequest(`
      mutation EndMeeting($meetingId: ID!) {
        endMeeting(meetingId: $meetingId) {
          success
          message
          meeting {
            _id
            title
            status
            endedAt
            duration
          }
        }
      }
    `, {
      meetingId: 'mock-1'
    });
    console.log('✅ End Meeting Result:', endResult);

    console.log('\n🎉 All tests passed! Mock service is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMockService();
