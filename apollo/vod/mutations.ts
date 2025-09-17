import { gql } from '@apollo/client';

// Mutation to create a VOD
export const CREATE_VOD = gql`
  mutation CreateVOD($input: CreateVODInput!) {
    createVOD(input: $input) {
      success
      message
      vod {
        _id
        title
        size
        duration
        url
        filePath
        createdAt
        status
      }
    }
  }
`;

// Mutation to update a VOD
export const UPDATE_VOD = gql`
  mutation UpdateVOD($id: ID!, $input: UpdateVODInput!) {
    updateVOD(id: $id, input: $input) {
      success
      message
      vod {
        _id
        title
        size
        duration
        url
        filePath
        updatedAt
        status
      }
    }
  }
`;

// Mutation to delete a VOD
export const DELETE_VOD = gql`
  mutation DeleteVOD($id: ID!) {
    deleteVOD(id: $id) {
      success
      message
    }
  }
`;

// Mutation to upload VOD file
export const UPLOAD_VOD_FILE = gql`
  mutation UploadVODFile($file: Upload!, $title: String!) {
    uploadVODFile(file: $file, title: $title) {
      success
      message
      vod {
        _id
        title
        size
        duration
        filePath
        createdAt
        status
      }
    }
  }
`;

// Mutation to create VOD from URL
export const CREATE_VOD_FROM_URL = gql`
  mutation CreateVODFromURL($url: String!, $title: String!) {
    createVODFromURL(url: $url, title: $title) {
      success
      message
      vod {
        _id
        title
        url
        createdAt
        status
      }
    }
  }
`;