# Picture-in-Picture (PiP) Functionality

## Overview
This implementation adds Picture-in-Picture mode for mobile users when they navigate away from live meeting rooms. The PiP overlay shows the main video stream with control buttons for returning to the room or leaving the meeting.

## Features

### ✅ Mobile-First Design
- Automatically detects mobile devices
- Activates PiP when users navigate away from the meeting
- Touch-friendly controls and interactions

### ✅ Smart Activation
- Triggers on page visibility changes
- Activates on browser navigation events
- Responds to window blur/focus events
- Handles back/forward navigation

### ✅ User Controls
- **Back to Room**: Returns to the main meeting interface
- **Leave Meeting**: Exits the meeting without confirmation
- **Close PiP**: Minimizes the PiP overlay

### ✅ Video Integration
- Displays the main video stream in PiP
- Maintains video quality and aspect ratio
- Shows meeting information (title, participant count)

### ✅ Responsive Design
- Adapts to different screen sizes
- Draggable on desktop (if needed)
- Optimized for mobile touch interactions

## Implementation

### Components

#### 1. PictureInPicture.tsx
The main PiP overlay component with:
- Draggable functionality (desktop)
- Touch support (mobile)
- Video display
- Control buttons
- Meeting information display

#### 2. usePictureInPicture.ts
Custom hook that manages:
- Mobile device detection
- Browser navigation events
- Page visibility changes
- PiP state management

### Integration Points

#### Video Room Page (`/pages/meeting/[meetingId]/video-room.tsx`)
- Integrated PiP functionality
- Uses videoRef for main video stream
- Handles leave meeting actions

#### Meeting Page (`/pages/meeting/[meetingId]/index.tsx`)
- Integrated PiP functionality
- Uses videoRef for main video stream
- Handles leave meeting actions

## Usage

### Automatic Activation
PiP mode automatically activates when:
1. User navigates to another page
2. User switches to another app (mobile)
3. User minimizes the browser (mobile)
4. Page becomes hidden

### Manual Controls
Users can:
1. **Back to Room**: Click the "Back" button to return to the meeting
2. **Leave Meeting**: Click the "Leave" button to exit the meeting
3. **Close PiP**: Click the "X" button to minimize the overlay

## Testing

### Test Page
A comprehensive test page is available at `/pages/test-pip.html` that includes:
- Camera and screen share testing
- PiP mode simulation
- Mobile device testing
- Navigation simulation

### Mobile Testing
To test on mobile devices:
1. Open the test page on a mobile device
2. Start camera or screen share
3. Navigate away from the page
4. PiP should automatically activate
5. Test the control buttons

## Technical Details

### Event Listeners
- `visibilitychange`: Detects when page becomes hidden/visible
- `beforeunload`: Prevents accidental navigation when not in PiP
- `popstate`: Handles back/forward navigation
- `blur`/`focus`: Detects window focus changes

### Mobile Detection
```javascript
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                 window.innerWidth <= 768;
```

### State Management
- `isPiPVisible`: Controls PiP overlay visibility
- `isPageHidden`: Tracks page visibility state
- `isMobile`: Device type detection

## Browser Compatibility

### Supported Browsers
- Chrome (Android/iOS)
- Safari (iOS)
- Firefox (Android)
- Edge (Android)

### Features by Browser
- **Chrome**: Full PiP support with all features
- **Safari**: Full PiP support with all features
- **Firefox**: Basic PiP support
- **Edge**: Full PiP support

## Customization

### Styling
The PiP component uses inline styles for maximum compatibility. Key customizable properties:
- `width`/`height`: PiP window size
- `borderRadius`: Corner rounding
- `backgroundColor`: Background color
- `border`: Border styling

### Behavior
Modify the `usePictureInPicture` hook to customize:
- Activation triggers
- Mobile detection logic
- Event handling behavior

## Troubleshooting

### Common Issues

1. **PiP not activating on mobile**
   - Check mobile detection logic
   - Verify event listeners are properly attached
   - Test on actual mobile device (not just browser dev tools)

2. **Video not showing in PiP**
   - Ensure videoRef is properly passed
   - Check video element is playing
   - Verify video permissions

3. **Controls not working**
   - Check event handlers are properly bound
   - Verify button click events
   - Test on different devices

### Debug Mode
Enable console logging by adding:
```javascript
console.log('PiP Debug:', { isPiPVisible, isPageHidden, isMobile });
```

## Future Enhancements

### Planned Features
- [ ] Audio controls in PiP
- [ ] Chat integration in PiP
- [ ] Multiple video streams
- [ ] PiP positioning memory
- [ ] Gesture controls (mobile)

### Performance Optimizations
- [ ] Video stream optimization
- [ ] Memory usage reduction
- [ ] Battery life optimization
- [ ] Network usage monitoring

## Security Considerations

### Data Protection
- No sensitive data stored in PiP
- Video streams are not recorded
- User actions are logged for debugging only

### Privacy
- Camera/microphone permissions required
- No data collection in PiP mode
- User can disable PiP functionality

## Support

For issues or questions regarding the PiP functionality:
1. Check the test page for basic functionality
2. Review browser console for errors
3. Test on different devices and browsers
4. Verify mobile detection is working correctly

## Changelog

### v1.0.0 (Current)
- Initial PiP implementation
- Mobile device detection
- Basic video display
- Control buttons (Back, Leave, Close)
- Browser navigation handling
- Responsive design
