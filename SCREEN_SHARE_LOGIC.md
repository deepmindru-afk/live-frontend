# Screen Share Logic Implementation

## Overview
This document explains how screen sharing works in the LiveKit video conferencing system.

## How It Works

### 1. **Thumbnails Display Camera Video**
When a user starts screen sharing:
- Their **camera video** continues to display in the thumbnail panel
- The thumbnail shows a **blue screen-sharing indicator** (monitor icon)
- Other participants can see who is screen sharing at a glance

### 2. **Main Stage Shows Screen Share**
When you click on a screen-sharing participant's thumbnail:
- The **main stage displays their screen share** (not their camera)
- The screen share video is shown in full quality
- Their camera video remains visible in the thumbnail

### 3. **Track Separation**
The implementation separates video tracks by source:
- **Camera tracks**: `source === 'camera'` → shown in thumbnails
- **Screen share tracks**: `source === 'screen_share'` → shown in main stage when selected

## Implementation Details

### Files Modified

#### 1. `ProfessionalLiveStreamRoom.tsx`
**Thumbnail Rendering (Lines 2704-2772)**
```typescript
// ✅ Get ONLY camera video track for thumbnail (NOT screen share)
const cameraTrackPub = Array.from(participant.videoTrackPublications.values())
  .find(pub => pub.track?.source === 'camera' || pub.source === 'camera');
videoTrack = cameraTrackPub?.track;

// Check if participant has screen share active
const screenSharePub = Array.from(participant.videoTrackPublications.values())
  .find(pub => pub.track?.source === 'screen_share' || pub.source === 'screen_share');
hasScreenShare = !!screenSharePub?.track;
```

**Main Stage Rendering (Lines 3100-3182)**
```typescript
// Get CAMERA video track (not screen share)
const cameraTrackPub = Array.from(participant.videoTrackPublications.values())
  .find(pub => pub.track?.source === 'camera' || pub.source === 'camera');
mainVideoTrack = cameraTrackPub?.track;

// Get screen share track separately
const screenShareTrackPub = Array.from(participant.videoTrackPublications.values())
  .find(pub => pub.track?.source === 'screen_share' || pub.source === 'screen_share');
mainScreenShareTrack = screenShareTrackPub?.track;
isParticipantScreenSharing = !!mainScreenShareTrack;
```

#### 2. `ParticipantThumbnail.tsx`
- Added `isScreenSharing` prop
- Displays screen-sharing indicator when active
- Shows monitor icon in blue

#### 3. `MainStageView.tsx`
- Already supports screen share display
- Prioritizes screen share over camera when both exist
- Shows screen share in full quality

#### 4. `RoomMain.module.scss`
- Added `.screen-sharing` indicator style with blue background
- Styled screen share monitor icon

#### 5. `ShareScreen.tsx` (New Component)
- Standalone screen share component
- Can be used for dedicated screen share views
- Includes header, video display, and live indicator

## User Experience Flow

1. **User A starts screen sharing**
   - User A's camera video stays in thumbnail
   - Blue monitor icon appears on User A's thumbnail
   - User A's screen share is NOT automatically shown

2. **User B clicks on User A's thumbnail**
   - Main stage switches to show User A's screen share
   - User A's camera remains in thumbnail
   - Screen share displays in full quality

3. **User A stops screen sharing**
   - Monitor icon disappears from thumbnail
   - If User A is on main stage, switches to camera video
   - Normal video conferencing continues

## Benefits

✅ **Clear Visual Feedback**: Blue indicator shows who is sharing  
✅ **Camera Visibility**: Presenter's face remains visible  
✅ **Easy Navigation**: Click any thumbnail to view their content  
✅ **Professional UX**: Similar to Zoom, Teams, Google Meet  
✅ **Track Isolation**: Proper separation of camera and screen tracks  

## Technical Notes

- Uses LiveKit's track source metadata (`camera` vs `screen_share`)
- Handles both local and remote participants
- Properly attaches/detaches video tracks to prevent memory leaks
- Works on both desktop and mobile (responsive)
- No breaking changes to existing functionality

## Testing

To test screen sharing:
1. Join a meeting with multiple participants
2. Start screen sharing (click screen share button)
3. Verify camera video appears in your thumbnail
4. Have another user click your thumbnail
5. Verify screen share appears in main stage
6. Stop screen sharing and verify return to normal

---
**Last Updated**: October 20, 2025

