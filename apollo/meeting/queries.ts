import { gql } from '@apollo/client';

export const GET_MEETING_BY_ID = gql`
  query GetMeetingById($meetingId: ID!) {
    getMeetingById(meetingId: $meetingId) {
      _id
      title
      status
      hostId
      currentHostId
      inviteCode
      isPrivate
      isLocked
      scheduledFor
      actualStartAt
      endedAt
      durationMin
      participantCount
      createdAt
      updatedAt
      host {
        _id
        email
        displayName
        systemRole
        avatarUrl
        organization
        department
      }
    }
  }
`;

export const GET_MEETING_ATTENDANCE = gql`
  query GetMeetingAttendance($meetingId: ID!) {
    getMeetingAttendance(meetingId: $meetingId) {
      meetingId
      totalParticipants
      presentParticipants
      absentParticipants
      averageAttendanceTime
      attendanceRate
      participants {
        _id
        displayName
        email
        firstName
        lastName
        systemRole
        avatarUrl
        organization
        department
        role
        joinedAt
        leftAt
        totalTime
        sessionCount
        isCurrentlyOnline
        status
        micState
        cameraState
        hasHandRaised
        handRaisedAt
        handLoweredAt
        sessions {
          joinedAt
          leftAt
          durationSec
        }
      }
    }
  }
`;

export const GET_TUTOR_ATTENDANCE_SUMMARY = gql`
  query GetTutorAttendanceSummary {
    getTutorAttendanceSummary {
      totalMeetings
      totalTime
      totalParticipants
      averageAttendance
      meetings {
        _id
        title
        startTime
        endTime
        duration
        participantCount
        attendanceRate
        status
      }
    }
  }
`;

export const GET_TUTOR_MEETINGS = gql`
  query GetTutorMeetings($input: MeetingQueryInput!) {
    getMeetings(input: $input) {
      meetings {
        _id
        title
        status
        inviteCode
        isPrivate
        isLocked
        scheduledFor
        actualStartAt
        endedAt
        durationMin
        participantCount
        createdAt
        updatedAt
        host {
          _id
          email
          displayName
          systemRole
          avatarUrl
          organization
          department
        }
      }
      total
      page
      limit
      offset
      hasMore
    }
  }
`;