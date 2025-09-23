Page: /meeting/[meetingId]

Use:
- mutation joinMeeting(meetingId) on enter
- mutation leaveMeeting(meetingId) on leave
- query getMeetingById(meetingId) to render header, participants count
- query getChatHistory(meetingId, pagination)
- mutation deleteChatMessage(messageId) (admin/host)
- (optional) query generateLivekitToken({ roomName, participantName, participantId }) if using LiveKit

Signaling (Socket.IO to NEXT_PUBLIC_SIGNALING_WS):
- JOIN_ROOM { meetingId, roomName: meetingId }
- LEAVE_ROOM { roomName }
- CHAT_SEND { roomName, message, replyToMessageId? }
- RTC_OFFER / RTC_ANSWER / ICE_CANDIDATE (if WebRTC P2P)
- Admin actions:
  - FORCE_MUTE { roomName, targetUserId? }   // everyone or specific
  - FORCE_CAMERA_OFF { roomName, targetUserId }
  - KICK_USER { roomName, targetUserId, reason? }

UI:
- Large video grid area (placeholder until LiveKit/WebRTC wired).
- Bottom controls: mic on/off, camera on/off, screen share, chat toggle, leave button.
- If ADMIN/HOST show: "모두 음소거", "카메라 끄기(대상)", "참여자 내보내기(대상)".







