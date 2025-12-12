# Whiteboard Components

## Overview
React components for whiteboard functionality using Excalidraw.

## Components

### WhiteboardComponent
Main whiteboard component that:
- Renders Excalidraw whiteboard
- Captures canvas as video stream
- Provides stream to parent for LiveKit publishing

**Props:**
```typescript
interface WhiteboardComponentProps {
  isActive: boolean;
  onStreamReady?: (stream: MediaStream) => void;
  onStreamStopped?: () => void;
  className?: string;
  style?: React.CSSProperties;
}
```

### WhiteboardCanvas
Canvas wrapper component that:
- Hosts Excalidraw's canvas element
- Provides methods to capture canvas as stream
- Exposes ref handle for parent access

**Ref Methods:**
```typescript
interface WhiteboardCanvasHandle {
  getCanvas: () => HTMLCanvasElement | null;
  captureStream: (fps?: number) => MediaStream | null;
  clear: () => void;
}
```

## Usage

```typescript
import { WhiteboardComponent } from './components/whiteboard';

<WhiteboardComponent
  isActive={isWhiteboardActive}
  onStreamReady={(stream) => {
    // Publish stream to LiveKit
    publishToLiveKit(stream);
  }}
  onStreamStopped={() => {
    // Cleanup
  }}
/>
```

## Integration with LiveKit

The whiteboard stream is published to LiveKit as a screen share track:
- Uses `source: 'screen_share'`
- Participants see it in main video area
- Same as regular screen sharing

## Next Steps

1. Install Excalidraw: `npm install @excalidraw/excalidraw`
2. Integrate Excalidraw component
3. Implement canvas capture
4. Connect to LiveKit publishing










