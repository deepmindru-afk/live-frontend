import { gql } from '@apollo/client';

export const REMOVE_PARTICIPANT = gql`
  mutation RemoveParticipant($participantId: ID!) {
    removeParticipant(participantId: $participantId) {
      success
      message
    }
  }
`;