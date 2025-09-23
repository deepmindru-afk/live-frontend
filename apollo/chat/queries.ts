import { gql } from '@apollo/client';

// ===== CHAT QUERIES =====

export const GET_CHAT_HISTORY = gql`
  query GetChatHistory($input: ChatHistoryInput!) {
    getChatHistory(input: $input) {
      messages {
        _id
        text
        userId
        displayName
        user {
          _id
          displayName
          avatarUrl
        }
        replyToMessageId
        replyToMessage {
          _id
          text
          displayName
        }
        createdAt
        updatedAt
      }
      total
      hasMore
      limit
      nextCursor
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
