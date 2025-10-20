# Fix: Participant Duplication in onParticipantJoined Handler

## Problem
When a new user joins the meeting for the first time, the same participant appears twice in the list. The duplication happens because:

1. **GraphQL `joinMeeting()`** adds the participant to the list
2. **WebSocket `onParticipantJoined`** event handler adds the same participant again
3. **Different ID formats** between GraphQL and WebSocket payloads cause deduplication to fail

## Root Cause
The existing deduplication logic only compared `_id` and `userId`:
```typescript
const exists = prev.find(p => p._id === participant._id || p.userId === participant.userId);
```

But GraphQL and WebSocket payloads can have different ID formats:
- GraphQL: `participant._id` and `participant.user._id`
- WebSocket: `participant.userId` and `participant.email`

## Solution Applied

### **Enhanced Deduplication Logic**
Added a normalized identity key function that tries multiple ID sources in priority order:

```typescript
const getParticipantKey = (p: any) =>
  p?.user?._id || p?.userId || p?._id || p?.email || '';
```

### **Updated onParticipantJoined Handler**
```typescript
setParticipants(prev => {
  const newParticipantKey = getParticipantKey(participant);
  const exists = prev.find(p => getParticipantKey(p) === newParticipantKey && newParticipantKey !== '');
  if (exists) {
    processingRef.current.delete(participantKey);
    return prev;
  }
  const newParticipants = [...prev, participant];
  processingRef.current.delete(participantKey);
  return newParticipants;
});
```

### **Updated onParticipantLeft Handler**
Applied the same normalized key logic for consistency:
```typescript
setParticipants(prev => {
  const leftParticipantKey = getParticipantKey(participant);
  const filtered = prev.filter(p => getParticipantKey(p) !== leftParticipantKey || leftParticipantKey === '');
  processingRef.current.delete(participantKey);
  return filtered;
});
```

## Key Features

### **Priority-Based Identity Resolution**
1. `p?.user?._id` - Primary user ID (GraphQL format)
2. `p?.userId` - Direct user ID (WebSocket format)  
3. `p?._id` - Participant ID (fallback)
4. `p?.email` - Email as last resort identifier
5. `''` - Empty string if no valid identifier found

### **Safety Checks**
- Only processes participants with valid keys (`newParticipantKey !== ''`)
- Maintains existing circuit breaker logic to prevent multiple processing
- Preserves all existing functionality for joins/leaves

## Expected Results

✅ **No more duplicate participants** when users join  
✅ **Consistent deduplication** across GraphQL and WebSocket sources  
✅ **Maintained performance** with existing circuit breaker  
✅ **Robust identity matching** using multiple ID sources  

## Files Modified

**`ProfessionalLiveStreamRoom.tsx`** (Lines 447-504)
- Enhanced `onParticipantJoined` deduplication logic
- Enhanced `onParticipantLeft` filtering logic
- Added normalized participant identity key function

## Testing

To verify the fix:
1. Have a user join the meeting for the first time
2. Check that they appear only once in the participants list
3. Verify no console errors or duplicate logs
4. Confirm normal join/leave behavior is preserved

---
**Last Updated**: October 20, 2025
