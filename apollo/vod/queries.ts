import { gql } from '@apollo/client';

// Query to get VODs with pagination
export const GET_VODS = gql`
  query GetVODs($pagination: PaginationInput!) {
    vods(pagination: $pagination) {
      _id
      title
      size
      duration
      url
      filePath
      createdAt
      updatedAt
      status
    }
  }
`;

// Query to get a specific VOD
export const GET_VOD_BY_ID = gql`
  query GetVODById($id: ID!) {
    vod(id: $id) {
      _id
      title
      size
      duration
      url
      filePath
      createdAt
      updatedAt
      status
    }
  }
`;

// Query to get VOD statistics
export const GET_VOD_STATS = gql`
  query GetVODStats {
    vodStats {
      totalVODs
      totalSize
      totalDuration
      averageSize
      averageDuration
    }
  }
`;