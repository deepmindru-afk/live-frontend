import { gql } from '@apollo/client';

export const UPDATE_SESSION = gql`
  mutation UpdateSession($input: UpdateSessionInput!) {
    updateSession(input: $input) {
      success
      message
    }
  }
`;