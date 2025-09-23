import { gql } from '@apollo/client';

// ===== CHAT MUTATIONS =====

export const DELETE_CHAT_MESSAGE = gql`
  mutation DeleteChatMessage($input: DeleteMessageInput!) {
    deleteChatMessage(input: $input) {
      success
      message
    }
  }
`;
