import { gql } from '@apollo/client';

// Query to get VODs with pagination - Updated to match backend schema
export const GET_VODS = gql`
  query GetAllVods($input: VodQueryInput!) {
    getAllVods(input: $input) {
      vods {
        _id
        title
        meetingId
        source
        storageKey
        sizeBytes
        durationSec
        notes
        createdAt
        updatedAt
        meeting {
          _id
          title
          status
          inviteCode
          scheduledFor
          actualStartAt
          endedAt
          durationMin
          host {
            _id
            email
            displayName
            systemRole
            avatarUrl
            department
          }
        }
      }
      total
      hasMore
    }
  }
`;

// Query to get a specific VOD - Updated to match backend schema
export const GET_VOD_BY_ID = gql`
  query GetVodById($vodId: ID!) {
    getVodById(vodId: $vodId) {
      _id
      title
      meetingId
      source
      storageKey
      sizeBytes
      durationSec
      notes
      createdAt
      updatedAt
      meeting {
        _id
        title
        status
        inviteCode
        scheduledFor
        actualStartAt
        endedAt
        durationMin
        host {
          _id
          email
          displayName
          systemRole
          avatarUrl
          department
        }
      }
    }
  }
`;

// Query to get VOD statistics - Updated to match backend schema
export const GET_VOD_STATS = gql`
  query GetVodStats {
    getVodStats {
      totalVods
      totalSizeBytes
      totalDurationSec
      averageSizeBytes
      averageDurationSec
    }
  }
`;