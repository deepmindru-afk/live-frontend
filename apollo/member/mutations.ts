import { gql } from '@apollo/client';

// Mutation to update user profile
export const UPDATE_PROFILE = gql`
  mutation UpdateProfile($input: UpdateMemberInput!) {
    updateProfile(input: $input) {
      _id
      email
      displayName
      avatarUrl
      organization
      department
      phone
      language
      timezone
      createdAt
      updatedAt
    }
  }
`;

// Mutation to upload profile image
export const UPLOAD_PROFILE_IMAGE = gql`
  mutation UploadProfileImage($file: Upload!) {
    uploadProfileImage(file: $file) {
      success
      message
      imageUrl
    }
  }
`;

// Mutation to delete profile image
export const DELETE_PROFILE_IMAGE = gql`
  mutation DeleteProfileImage {
    deleteProfileImage {
      success
      message
    }
  }
`;