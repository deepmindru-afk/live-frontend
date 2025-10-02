import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

// Updated: X button only, no Leave text

interface PictureInPictureProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  meetingId: string;
  meetingTitle: string;
  participantCount: number;
  onLeaveMeeting: () => void;
  onBackToRoom: () => void;
  isVisible: boolean;
  onClose: () => void;
}

const PictureInPicture: React.FC<PictureInPictureProps> = ({
  videoRef,
  meetingId,
  meetingTitle,
  participantCount,
  onLeaveMeeting,
  onBackToRoom,
  isVisible,
  onClose
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const pipRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Detect mobile devices
  const isMobile = typeof window !== 'undefined' && 
    (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
     window.innerWidth <= 768);

  // Handle drag functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isMobile) {
      setIsDragging(true);
      const rect = pipRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && !isMobile) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Keep within viewport bounds
      const maxX = window.innerWidth - 300;
      const maxY = window.innerHeight - 200;
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Handle touch events for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isMobile) {
      const touch = e.touches[0];
      const rect = pipRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top
        });
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isMobile) {
      e.preventDefault();
      const touch = e.touches[0];
      const newX = touch.clientX - dragOffset.x;
      const newY = touch.clientY - dragOffset.y;
      
      // Keep within viewport bounds
      const maxX = window.innerWidth - 300;
      const maxY = window.innerHeight - 200;
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    }
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          zIndex: 9998,
          pointerEvents: 'none'
        }}
      />
      
      {/* PiP Container */}
      <div
        ref={pipRef}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          width: isMobile ? '280px' : '300px',
          height: isMobile ? '180px' : '200px',
          backgroundColor: '#1a1a1a',
          borderRadius: '12px',
          border: '2px solid #3b82f6',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
          zIndex: 9999,
          overflow: 'hidden',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none'
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        {/* Header */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '40px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            zIndex: 2
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                backgroundColor: '#ef4444',
                borderRadius: '50%',
                animation: 'pulse 2s infinite'
              }}
            />
            <span
              style={{
                color: 'white',
                fontSize: '12px',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '150px'
              }}
            >
              {meetingTitle}
            </span>
          </div>
          
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '16px',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {/* Video Container */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            marginTop: '40px'
          }}
        >
          {videoRef.current && (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                backgroundColor: '#000'
              }}
            />
          )}
          
          {/* Video overlay info */}
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              left: '8px',
              right: '8px',
              background: 'rgba(0, 0, 0, 0.7)',
              borderRadius: '6px',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span
              style={{
                color: 'white',
                fontSize: '10px',
                fontWeight: '500'
              }}
            >
              {participantCount} participants
            </span>
            <span
              style={{
                color: '#4ade80',
                fontSize: '10px',
                fontWeight: '600'
              }}
            >
              ● Live
            </span>
          </div>
        </div>

        {/* Control Buttons */}
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '8px',
            display: 'flex',
            gap: '6px',
            zIndex: 3
          }}
        >
          <button
            onClick={onBackToRoom}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '10px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
            }}
            title="Back to Room"
          >
            <span>↩</span>
            <span>Back</span>
          </button>
          
          <button
            onClick={onLeaveMeeting}
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '10px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
            }}
            title="Leave Meeting"
          >
            <span>✕</span>
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </>
  );
};

export default PictureInPicture;
