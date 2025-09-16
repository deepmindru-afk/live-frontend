import { gql } from '@apollo/client';

// ===== AUTHENTICATION MUTATIONS =====

export const SIGNUP = gql`
  mutation Signup($input: SignupInput!) {
    signup(input: $input) {
      success
      message
      user {
        _id
        email
        displayName
        systemRole
        createdAt
      }
      token
    }
  }
`;

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      success
      message
      user {
        _id
        email
        displayName
        systemRole
        lastSeenAt
      }
      token
    }
  }
`;

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
      systemRole
      updatedAt
    }
  }
`;

export const CHANGE_PASSWORD = gql`
  mutation ChangePassword($input: ChangePasswordInput!) {
    changePassword(input: $input) {
      success
      message
    }
  }
`;

export const LOGOUT = gql`
  mutation Logout {
    logout {
      success
      message
      timestamp
    }
  }
`;

export const UPLOAD_PROFILE_IMAGE = gql`
  mutation UploadProfileImage($file: String!) {
    uploadProfileImage(file: $file) {
      success
      message
      avatarUrl
      user {
        _id
        email
        displayName
        avatarUrl
        systemRole
      }
    }
  }
`;

export const DELETE_PROFILE_IMAGE = gql`
  mutation DeleteProfileImage {
    deleteProfileImage {
      success
      message
      user {
        _id
        email
        displayName
        avatarUrl
        systemRole
      }
    }
  }
`;

export const DELETE_MEMBER = gql`
  mutation DeleteMember($id: ID!) {
    deleteMember(id: $id) {
      success
      message
    }
  }
`;
