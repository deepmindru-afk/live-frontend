import { gql } from '@apollo/client';

// ===== VOD MUTATIONS =====

export const UPLOAD_VOD_FILE = gql`
  mutation UploadVodFile($file: Upload!, $meetingId: ID, $title: String, $notes: String) {
    uploadVodFile(file: $file, meetingId: $meetingId, title: $title, notes: $notes) {
      success
      message
      vodId
    }
  }
`;

export const CREATE_VOD_URL = gql`
  mutation CreateVodUrl($input: CreateVodUrlInput!) {
    createVodUrl(input: $input) {
      success
      message
      vodId
    }
  }
`;

export const UPDATE_VOD = gql`
  mutation UpdateVod($id: ID!, $input: UpdateVodInput!) {
    updateVod(id: $id, input: $input) {
      _id
      title
      meetingId
      source
      url
      durationSec
      notes
      updatedAt
    }
  }
`;

export const DELETE_VOD = gql`
  mutation DeleteVod($id: ID!) {
    deleteVod(id: $id) {
      success
      message
    }
  }
`;
