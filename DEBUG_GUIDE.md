# Video Element Race Condition Debug Guide

## 🎯 What We're Tracking

This debug logging will help us identify the exact race conditions and issues with video element registrations and track attachments.

## 📊 Console Log Categories

The logs are color-coded by category:

| Category | Color | What It Tracks |
|----------|-------|----------------|
| **REF_REGISTER** | 🟣 Purple | Video element registration (when ref callback fires) |
| **TRACK_ATTACH** | 🟢 Green | Track attachment operations |
| **TRACK_DETACH** | 🔴 Red | Track detachment operations |
| **ELEMENT_LOOKUP** | 🔵 Blue | Video element lookup attempts |
| **CLEANUP** | 🟠 Orange | Cleanup and resource deallocation |
| **ERROR** | 🔴 Dark Red | Errors during operations |
| **WARNING** | 🟡 Yellow | Potential issues detected |

## 🔍 Key Things to Watch For

### 1. **Multiple Registrations of Same Element**

Look for logs like:
```
[REF_REGISTER] 📹 NEW video element registered for John Doe
  totalKeys: 4
  allKeys: ["user123", "user123", "participant456", "John Doe"]
```

**What this means:** The SAME video element is being stored under 4 different keys. This is the root of the problem.

---

### 2. **Duplicate Track Attachments**

Look for:
```
[WARNING] ⚠️ Video element already has track attached!
  existingTrackRef: true
  existingSrcObject: true
```

**What this means:** A track is being attached to a video element that already has a track. This causes black screens and flickering.

---

### 3. **Dangling References After Cleanup**

Look for:
```
[WARNING] ⚠️ DANGLING REFERENCES DETECTED!
  danglingKeys: ["John Doe", "participant456"]
  totalKeysForThisElement: 3
```

**What this means:** After detaching a track, the same video element is still registered under other keys. This causes memory leaks and stale references.

---

### 4. **Lookup Method Mismatches**

Watch the sequence:
```
[ELEMENT_LOOKUP] Attempt 1: Looking up by participant.identity="user123"
  found: false

[ELEMENT_LOOKUP] Attempt 3: Found via participant.name="John Doe"
  foundByName: true

[TRACK_ATTACH] ✅ Track successfully attached
  lookupKey: "John Doe"
  lookupMethod: "FALLBACK_2_NAME"
  trackRefStoredAs: "user123"
```

**What this means:** Track was attached using key "John Doe" but track reference was stored using key "user123". This creates a mismatch that will cause cleanup issues.

---

### 5. **Component Re-render Causing Re-registration**

Look for multiple registrations in quick succession:
```
[REF_REGISTER] 🔄 Re-registering SAME video element for John Doe
  sameElement: true
  totalKeys: 4
```

**What this means:** React is re-rendering and firing the ref callback again, re-registering the same element. Combined with async track events, this creates race conditions.

---

## 🧪 Test Scenarios

### Test 1: Single Participant Joins
**What to watch:**
1. `[REF_REGISTER]` should fire ONCE with 4 keys
2. `[TRACK_ATTACH]` should fire ONCE
3. `lookupMethod` should match the `primaryKey` used in registration
4. Should see NO warnings about existing tracks

### Test 2: Participant Leaves
**What to watch:**
1. `[TRACK_DETACH]` should fire
2. `[CLEANUP]` should show cleanup happening
3. Check for `⚠️ DANGLING REFERENCES DETECTED!` - this proves our theory
4. After cleanup, `videoRefKeys` should be empty or only contain other participants

### Test 3: Multiple Participants Join Simultaneously
**What to watch:**
1. Each participant should get separate video element
2. No cross-contamination of tracks between participants
3. Look for warnings about duplicate attachments
4. Check if lookup methods differ between participants

### Test 4: Component Re-renders (Toggle view mode, etc.)
**What to watch:**
1. `[REF_REGISTER]` firing multiple times for same participant
2. `🔄 Re-registering SAME video element` messages
3. Track attachments happening during re-renders
4. Race between ref callback and track subscription events

---

## 🎯 Expected Issues We'll Find

Based on the theory, we expect to see:

### Issue #1: Multi-Key Registration
```
[REF_REGISTER] NEW video element
  allKeys: ["userId", "identity", "participantId", "displayName"]
```
✅ **This proves:** Same element stored under 4 keys

### Issue #2: Lookup Using Different Key Than Storage
```
[TRACK_ATTACH] Track attached
  lookupKey: "displayName"
  trackRefStoredAs: "identity"
```
✅ **This proves:** Inconsistent key usage

### Issue #3: Incomplete Cleanup
```
[CLEANUP] Starting cleanup
  allVideoRefKeys: ["user123", "John Doe", "participant456", "user123"]

[CLEANUP] Cleaned up via identity="user123"

[WARNING] DANGLING REFERENCES DETECTED!
  danglingKeys: ["John Doe", "participant456"]
```
✅ **This proves:** Only one key cleaned up, others remain

### Issue #4: Duplicate Attachment Attempts
```
[WARNING] Video element already has track attached!
  existingTrackRef: true
  lookupMethod: "FALLBACK_2_NAME"
```
✅ **This proves:** Same element being reused causing conflicts

---

## 📋 How to Use This Debug Output

1. **Open Browser Console** (F12)
2. **Join a meeting** as participant
3. **Filter console logs** by clicking the category colors or searching for specific patterns
4. **Look for the warning messages** - these indicate the race conditions
5. **Track the sequence of events**:
   - Registration → Lookup → Attachment → Cleanup
   - See if the keys match throughout the lifecycle

## 🎬 Next Steps After Debugging

Once we confirm the issues through logging:

1. **Identify the most common lookup method** (PRIMARY vs FALLBACK_1 vs FALLBACK_2)
2. **Determine the canonical key** to use (probably `participant.identity`)
3. **Remove multi-key registration** - use ONLY one key per element
4. **Ensure cleanup uses the SAME key** as registration
5. **Add proper deduplication** to prevent multiple attachments

---

## 💡 Pro Tips

- **Use Chrome DevTools Timeline** to see timing of events
- **Set breakpoints** on the warning logs to inspect state
- **Compare successful vs failing scenarios** (working video vs black screen)
- **Test with 2-3 participants** to see interaction effects
- **Test view mode switches** to trigger re-renders

---

## 🚨 Critical Patterns to Look For

### Pattern A: The "Re-registration Loop"
```
[REF_REGISTER] NEW video element for User1
[REF_REGISTER] Re-registering SAME for User1
[REF_REGISTER] Re-registering SAME for User1
```
Indicates unnecessary re-renders triggering ref callbacks.

### Pattern B: The "Key Mismatch Dance"
```
[ELEMENT_LOOKUP] Attempt 1: identity="123" - NOT FOUND
[ELEMENT_LOOKUP] Attempt 3: name="John" - FOUND
[TRACK_ATTACH] Stored as: "123"
[CLEANUP] Looking for: "123" - NOT FOUND
```
Track attached via one key, stored under another, can't be cleaned up.

### Pattern C: The "Dangling Reference Chain"
```
[REF_REGISTER] Keys: ["A", "B", "C", "D"]
[CLEANUP] Cleaned key "A"
[WARNING] Dangling: ["B", "C", "D"]
```
Multi-key registration with single-key cleanup.

---

**Good luck debugging! The logs should clearly show us the exact race conditions happening. 🐛🔍**

