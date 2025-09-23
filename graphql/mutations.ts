import { gql } from '@apollo/client';

export const HOST_LOWER_HAND = gql`
  mutation HostLowerHand($input: HostLowerHandInput!) {
    hostLowerHand(input: $input) {
      success
      message
    }
  }
`;