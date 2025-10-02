import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';

interface UsePictureInPictureOptions {
  meetingId: string;
  meetingTitle: string;
  participantCount: number;
  onLeaveMeeting: () => void;
  isMobile?: boolean;
}

export const usePictureInPicture = ({
  meetingId,
  meetingTitle,
  participantCount,
  onLeaveMeeting,
  isMobile = false
}: UsePictureInPictureOptions) => {
  const [isPiPVisible, setIsPiPVisible] = useState(false);
  const [isPageHidden, setIsPageHidden] = useState(false);
  const [originalUrl, setOriginalUrl] = useState<string>('');
  const router = useRouter();

  // Detect if device is mobile
  const detectMobile = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth <= 768;
  }, []);

  // Handle page visibility change
  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      setIsPageHidden(true);
      // Show PiP when page becomes hidden (user navigates away)
      if (detectMobile() || isMobile) {
        setIsPiPVisible(true);
      }
    } else {
      setIsPageHidden(false);
      // Hide PiP when page becomes visible again
      setIsPiPVisible(false);
    }
  }, [detectMobile, isMobile]);

  // Handle beforeunload event
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    // Only show confirmation if PiP is not active
    if (!isPiPVisible) {
      e.preventDefault();
      e.returnValue = 'Are you sure you want to leave the meeting?';
      return 'Are you sure you want to leave the meeting?';
    }
  }, [isPiPVisible]);

  // Handle popstate (back/forward navigation)
  const handlePopState = useCallback((e: PopStateEvent) => {
    // If user navigates back/forward while in meeting, show PiP
    if (detectMobile() || isMobile) {
      setIsPiPVisible(true);
    }
  }, [detectMobile, isMobile]);

  // Handle focus/blur events
  const handleWindowBlur = useCallback(() => {
    if (detectMobile() || isMobile) {
      setIsPiPVisible(true);
    }
  }, [detectMobile, isMobile]);

  const handleWindowFocus = useCallback(() => {
    setIsPiPVisible(false);
  }, []);

  // Back to room functionality
  const backToRoom = useCallback(() => {
    setIsPiPVisible(false);
    // Navigate back to the meeting room
    if (originalUrl) {
      router.push(originalUrl);
    } else {
      router.push(`/meeting/${meetingId}`);
    }
  }, [originalUrl, meetingId, router]);

  // Close PiP functionality
  const closePiP = useCallback(() => {
    setIsPiPVisible(false);
  }, []);

  // Leave meeting from PiP
  const leaveMeetingFromPiP = useCallback(() => {
    setIsPiPVisible(false);
    onLeaveMeeting();
  }, [onLeaveMeeting]);

  // Set up event listeners
  useEffect(() => {
    // Store original URL when component mounts
    if (typeof window !== 'undefined') {
      setOriginalUrl(window.location.pathname);
    }

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [handleVisibilityChange, handleBeforeUnload, handlePopState, handleWindowBlur, handleWindowFocus]);

  // Handle route changes
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      // If user navigates to a different page while in meeting, show PiP
      if (url !== originalUrl && (detectMobile() || isMobile)) {
        setIsPiPVisible(true);
      }
    };

    router.events.on('routeChangeStart', handleRouteChange);
    
    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [router.events, originalUrl, detectMobile, isMobile]);

  return {
    isPiPVisible,
    isPageHidden,
    backToRoom,
    closePiP,
    leaveMeetingFromPiP,
    isMobile: detectMobile()
  };
};
