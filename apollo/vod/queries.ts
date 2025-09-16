import { gql } from '@apollo/client';

// ===== VOD QUERIES =====

export const GET_ALL_VODS = gql`
  query GetAllVods($query: VodQueryInput) {
    getAllVods(query: $query) {
      _id
      title
      meetingId
      source
      storageKey
      sizeBytes
      url
      durationSec
      notes
      createdAt
      updatedAt
    }
  }
`;

export const GET_VOD_BY_ID = gql`
  query GetVodById($id: ID!) {
    getVodById(id: $id) {
      _id
      title
      meetingId
      source
      storageKey
      sizeBytes
      url
      durationSec
      notes
      createdAt
      updatedAt
    }
  }
`;

export const GET_VOD_STATS = gql`
  query GetVodStats {
    getVodStats {
      totalVods
      totalSizeBytes
      totalDurationSec
      averageFileSize
      averageDuration
      vodsBySource {
        FILE
        URL
      }
    }
  }
`;

export const SEARCH_VODS = gql`
  query SearchVods($query: String!, $limit: Int, $offset: Int) {
    searchVods(query: $query, limit: $limit, offset: $offset) {
      _id
      title
      meetingId
      source
      url
      durationSec
      createdAt
    }
  }
`;
