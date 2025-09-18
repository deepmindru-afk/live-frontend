import { gql } from '@apollo/client';

// Mutation to delete a meeting
export const DELETE_MEETING = gql`
  mutation DeleteMeeting($meetingId: ID!) {
    deleteMeeting(meetingId: $meetingId) {
      success
      message
    }
  }
`;

// Mutation to remove a participant from a meeting
export const REMOVE_PARTICIPANT = gql`
  mutation RemoveParticipant($participantId: ID!) {
    removeParticipant(id: $participantId) {
      success
      message
    }
  }
`;

// Mutation to update a meeting
export const UPDATE_MEETING = gql`
  mutation UpdateMeeting($input: UpdateMeetingInput!) {
    updateMeeting(input: $input) {
      _id
      title
      status
      scheduledFor
      inviteCode
      notes
      isPrivate
      maxParticipants
      duration
      updatedAt
    }
  }
`;

// Mutation to rotate invite code
export const ROTATE_INVITE_CODE = gql`
  mutation RotateInviteCode($meetingId: ID!) {
    rotateInviteCode(meetingId: $meetingId) {
      inviteCode
    }
  }
`;

// Mutation to force end a meeting
export const FORCE_END_MEETING = gql`
  mutation ForceEndMeeting($meetingId: ID!) {
    endMeeting(meetingId: $meetingId) {
      _id
      status
      endedAt
      durationMin
    }
  }
`;

// Mutation to promote user role (Admin only)
export const PROMOTE_USER_ROLE = gql`
  mutation PromoteUserRole($userId: ID!, $newRole: String!) {
    promoteUserRole(userId: $userId, newRole: $newRole) {
      success
      message
      user {
        _id
        email
        displayName
        systemRole
      }
    }
  }
`;

// Mutation to delete a member (Admin only)
export const DELETE_MEMBER = gql`
  mutation DeleteMember($userId: ID!) {
    deleteMember(userId: $userId) {
      message
    }
  }
`;


// Mutation to update member status
export const UPDATE_MEMBER_STATUS = gql`
  mutation UpdateMemberStatus($memberId: ID!, $isActive: Boolean!) {
    updateMemberStatus(memberId: $memberId, isActive: $isActive) {
      _id
      isActive
      updatedAt
    }
  }
`;
