import { gql } from '@apollo/client';

// Mutation to create a VOD - Updated to match backend schema
export const CREATE_VOD = gql`
  mutation CreateVod($input: CreateVodInput!) {
    createVod(input: $input) {
      success
      message
      vod {
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
        }
      }
    }
  }
`;

// Mutation to update a VOD - Updated to match backend schema
export const UPDATE_VOD = gql`
  mutation UpdateVod($vodId: ID!, $input: UpdateVodInput!) {
    updateVod(vodId: $vodId, input: $input) {
      success
      message
      vod {
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
        }
      }
    }
  }
`;

// Mutation to delete a VOD - Updated to match backend schema
export const DELETE_VOD = gql`
  mutation DeleteVod($vodId: ID!) {
    deleteVod(vodId: $vodId) {
      success
      message
    }
  }
`;

// Mutation to upload VOD file - Updated to match backend schema
export const UPLOAD_VOD_FILE = gql`
  mutation UploadVodFile($input: CreateVodFileInput!, $file: Upload!) {
    uploadVodFile(input: $input, file: $file) {
      success
      message
      vod {
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
        }
      }
    }
  }
`;

// Mutation to create VOD from URL - Updated to match backend schema
export const CREATE_VOD_FROM_URL = gql`
  mutation CreateVodFromUrl($input: CreateVodUrlInput!) {
    createVodFromUrl(input: $input) {
      success
      message
      vod {
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
        }
      }
    }
  }
`;