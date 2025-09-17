Page: /waiting

Use:
- mutation joinMeetingByCode(inviteCode) -> { meetingId, inviteCode, participant {...} }

Behavior:
- Input: Invite code, START button.
- On success: redirect to /meeting/[meetingId]
- Also connect to signaling WS (NEXT_PUBLIC_SIGNALING_WS), optional waiting-room events later:
  - JOIN_WAITING_ROOM, LEAVE_WAITING_ROOM
  - HOST_JOIN_MEETING, PARTICIPANT_APPROVED/REJECTED/ADMITTED
- Errors: SweetAlert2.
