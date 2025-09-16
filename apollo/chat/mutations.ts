import { gql } from '@apollo/client';

// ===== CHAT MUTATIONS =====

export const DELETE_CHAT_MESSAGE = gql`
  mutation DeleteChatMessage($id: ID!) {
    deleteChatMessage(id: $id) {
      success
      message
    }
  }
`;
