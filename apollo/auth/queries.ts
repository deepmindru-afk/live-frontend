import { gql } from '@apollo/client';

// ===== AUTHENTICATION QUERIES =====

export const GET_CURRENT_USER = gql`
  query GetCurrentUser {
    me {
      _id
      email
      displayName
      avatarUrl
      organization
      department
      phone
      language
      timezone
      systemRole
      lastSeenAt
      createdAt
      updatedAt
    }
  }
`;

export const GET_ALL_MEMBERS = gql`
  query GetAllMembers {
    members {
      _id
      email
      displayName
      avatarUrl
      organization
      department
      phone
      language
      timezone
      systemRole
      lastSeenAt
      createdAt
      updatedAt
    }
  }
`;

export const GET_MEMBER_BY_ID = gql`
  query GetMemberById($id: ID!) {
    member(id: $id) {
      _id
      email
      displayName
      avatarUrl
      organization
      department
      phone
      language
      timezone
      systemRole
      lastSeenAt
      createdAt
      updatedAt
    }
  }
`;

export const HEALTH_CHECK = gql`
  query HealthCheck {
    health {
      status
      timestamp
      uptime
      memory {
        rss
        heapTotal
        heapUsed
        external
        arrayBuffers
      }
      version
    }
  }
`;
