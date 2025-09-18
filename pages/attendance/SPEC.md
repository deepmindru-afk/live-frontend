Page: /attendance/[meetingId]

Use:
- query getMeetingById(meetingId) -> { title, participants{ joinedAt, leftAt }, durationSec }
- query getParticipantsByMeeting(meetingId) for full list with login info
- query getParticipantStats(meetingId) for aggregate stats (if available)

UI:
- Top summary: title, 참가자 수, 진행 시간
- Table: No, 참가자, 참석 시간, 참여 시간(= left-joined), 비고
- 버튼: "엑셀 다운로드" (front generates csv/xlsx), Search box (filter table)

