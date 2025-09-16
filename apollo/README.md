# Apollo GraphQL API

This folder contains all GraphQL queries, mutations, and types for the Live Solution application.

## 📁 Structure

```
apollo/
├── auth/                    # Authentication APIs
│   ├── queries.ts          # User queries
│   └── mutations.ts        # User mutations
├── participants/            # Participant management APIs
│   ├── queries.ts          # Participant queries
│   └── mutations.ts        # Participant mutations
├── vod/                    # Video on Demand APIs
│   ├── queries.ts          # VOD queries
│   └── mutations.ts        # VOD mutations
├── chat/                   # Chat management APIs
│   ├── queries.ts          # Chat queries
│   └── mutations.ts        # Chat mutations
├── livekit/                # LiveKit integration APIs
│   ├── queries.ts          # LiveKit queries
│   └── mutations.ts        # LiveKit mutations
├── types.ts                # TypeScript interfaces
├── client.ts               # Apollo Client configuration
├── index.ts                # Main exports
└── README.md               # This file
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install @apollo/client graphql
```

### 2. Import and Use
```typescript
import { apolloClient, GET_CURRENT_USER, LOGIN } from './apollo';

// Use in React component
const { data, loading, error } = useQuery(GET_CURRENT_USER);
const [login] = useMutation(LOGIN);
```

## 📚 Available APIs

### 🔐 Authentication
- **Queries**: `GET_CURRENT_USER`, `GET_ALL_MEMBERS`, `GET_MEMBER_BY_ID`, `HEALTH_CHECK`
- **Mutations**: `SIGNUP`, `LOGIN`, `UPDATE_PROFILE`, `CHANGE_PASSWORD`, `DELETE_MEMBER`

### 👥 Participants
- **Queries**: `GET_PARTICIPANTS_BY_MEETING`, `GET_PARTICIPANT_STATS`, `GET_WAITING_PARTICIPANTS`, `CAN_BE_HOST`, `GET_MEETING_ATTENDANCE`
- **Mutations**: `CREATE_PARTICIPANT`, `JOIN_MEETING`, `LEAVE_MEETING`, `FORCE_MUTE_PARTICIPANT`, `TRANSFER_HOST`, `PRE_MEETING_SETUP`

### 🎥 VOD Management
- **Queries**: `GET_ALL_VODS`, `GET_VOD_BY_ID`, `GET_VOD_STATS`, `SEARCH_VODS`
- **Mutations**: `UPLOAD_VOD_FILE`, `CREATE_VOD_URL`, `UPDATE_VOD`, `DELETE_VOD`

### 💬 Chat
- **Queries**: `GET_CHAT_HISTORY`, `SEARCH_CHAT_MESSAGES`, `GET_CHAT_STATS`, `GET_CHAT_MESSAGE_BY_ID`
- **Mutations**: `DELETE_CHAT_MESSAGE`

### 🎬 LiveKit
- **Queries**: `GET_LIVEKIT_TOKEN`, `GET_ROOM_INFO`, `GET_ROOM_STATS`, `GET_RECORDINGS`
- **Mutations**: `CREATE_LIVEKIT_TOKEN`, `START_RECORDING`, `STOP_RECORDING`, `MUTE_PARTICIPANT`

## 🔧 Configuration

### Environment Variables
```bash
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:3007/graphql
NEXT_PUBLIC_WS_URL=ws://localhost:3007/graphql
```

### Apollo Client Setup
```typescript
import { apolloClient } from './apollo/client';

// Use with React
<ApolloProvider client={apolloClient}>
  <App />
</ApolloProvider>
```

## 📝 Usage Examples

### Authentication
```typescript
import { useQuery, useMutation } from '@apollo/client';
import { GET_CURRENT_USER, LOGIN } from './apollo';

function LoginComponent() {
  const [login, { loading, error }] = useMutation(LOGIN);
  
  const handleLogin = async (email: string, password: string) => {
    try {
      const { data } = await login({
        variables: { email, password }
      });
      console.log('Login successful:', data.login);
    } catch (err) {
      console.error('Login failed:', err);
    }
  };
}
```

### Participants
```typescript
import { useQuery } from '@apollo/client';
import { GET_PARTICIPANTS_BY_MEETING } from './apollo';

function ParticipantsList({ meetingId }: { meetingId: string }) {
  const { data, loading, error } = useQuery(GET_PARTICIPANTS_BY_MEETING, {
    variables: { meetingId }
  });
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      {data?.getParticipantsByMeeting?.map(participant => (
        <div key={participant._id}>
          {participant.displayName} - {participant.role}
        </div>
      ))}
    </div>
  );
}
```

### VOD Management
```typescript
import { useQuery, useMutation } from '@apollo/client';
import { GET_ALL_VODS, UPLOAD_VOD_FILE } from './apollo';

function VODManager() {
  const { data: vods } = useQuery(GET_ALL_VODS);
  const [uploadVod] = useMutation(UPLOAD_VOD_FILE);
  
  const handleUpload = async (file: File) => {
    try {
      const { data } = await uploadVod({
        variables: { file, title: 'My Video' }
      });
      console.log('Upload successful:', data.uploadVodFile);
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };
}
```

## 🛠️ Custom Hooks

You can create custom hooks for better reusability:

```typescript
// hooks/useAuth.ts
import { useQuery, useMutation } from '@apollo/client';
import { GET_CURRENT_USER, LOGIN } from '../apollo';

export const useAuth = () => {
  const { data: user, loading } = useQuery(GET_CURRENT_USER);
  const [login] = useMutation(LOGIN);
  
  return {
    user: user?.me,
    loading,
    login
  };
};
```

## 🔒 Authentication

The Apollo Client is configured with automatic token management:

```typescript
import { setAuthToken, clearAuthToken, isAuthenticated } from './apollo';

// Set token after login
setAuthToken(token);

// Check if user is authenticated
if (isAuthenticated()) {
  // User is logged in
}

// Clear token on logout
clearAuthToken();
```

## 📊 Error Handling

The client includes comprehensive error handling:

- **GraphQL Errors**: Logged to console
- **Network Errors**: Handled with retry logic
- **401 Errors**: Automatic token cleanup and redirect
- **Cache Errors**: Graceful fallbacks

## 🚀 Best Practices

1. **Use TypeScript**: All types are included for better development experience
2. **Cache Management**: Leverage Apollo's caching for better performance
3. **Error Boundaries**: Implement error boundaries in your React components
4. **Loading States**: Always handle loading and error states
5. **Optimistic Updates**: Use optimistic updates for better UX

## 📞 Support

For questions or issues with the GraphQL APIs, please refer to the main project documentation or contact the development team.
