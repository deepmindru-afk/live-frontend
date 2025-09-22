import { gql } from '@apollo/client';

// Mutation to update user profile
export const UPDATE_PROFILE = gql`
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      success
      message
      user {
        _id
        displayName
        email
        department
        phone
        avatarUrl
        systemRole
      }
    }
  }
`;

// Mutation to upload profile image
export const UPLOAD_PROFILE_IMAGE = gql`
  mutation UploadProfileImage($file: Upload!) {
    uploadProfileImage(file: $file) {
      success
      message
      user {
        _id
        displayName
        email
        avatarUrl
      }
    }
  }
`;

// Mutation to delete profile image
export const DELETE_PROFILE_IMAGE = gql`
  mutation DeleteProfileImage {
    deleteProfileImage {
      success
      message
      user {
        _id
        displayName
        email
        avatarUrl
      }
    }
  }
`;





