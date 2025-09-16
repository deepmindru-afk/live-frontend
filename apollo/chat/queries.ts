import { gql } from '@apollo/client';

// ===== CHAT QUERIES =====

export const GET_CHAT_HISTORY = gql`
  query GetChatHistory($meetingId: ID!, $limit: Int, $offset: Int) {
    getChatHistory(meetingId: $meetingId, limit: $limit, offset: $offset) {
      _id
      meetingId
      userId
      displayName
      message
      messageType
      isModerated
      isDeleted
      createdAt
      updatedAt
    }
  }
`;

export const SEARCH_CHAT_MESSAGES = gql`
  query SearchChatMessages($meetingId: ID!, $query: String!, $limit: Int, $offset: Int) {
    searchChatMessages(meetingId: $meetingId, query: $query, limit: $limit, offset: $offset) {
      _id
      meetingId
      userId
      displayName
      message
      messageType
      isModerated
      isDeleted
      createdAt
    }
  }
`;

export const GET_CHAT_STATS = gql`
  query GetChatStats($meetingId: ID!) {
    getChatStats(meetingId: $meetingId) {
      totalMessages
      messagesToday
      averageMessagesPerUser
      mostActiveUsers {
        userId
        displayName
        messageCount
      }
      messageTypes {
        TEXT
        IMAGE
        FILE
        SYSTEM
      }
    }
  }
`;

export const GET_CHAT_MESSAGE_BY_ID = gql`
  query GetChatMessageById($id: ID!) {
    getChatMessageById(id: $id) {
      _id
      meetingId
      userId
      displayName
      message
      messageType
      isModerated
      isDeleted
      createdAt
      updatedAt
    }
  }
`;
