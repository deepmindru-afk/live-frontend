import React, { useRef, useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

// Excalidraw CSS는 _app.js에서 import됨

// SSR 문제를 피하기 위해 Excalidraw를 동적으로 import
const Excalidraw = dynamic(
  async () => {
    const excalidraw = await import('@excalidraw/excalidraw');
    return excalidraw.Excalidraw;
  },
  { 
    ssr: false,
    loading: () => (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%',
        backgroundColor: '#ffffff'
      }}>
        <p>화이트보드 로딩 중...</p>
      </div>
    )
  }
);

// exportToCanvas를 별도로 import
let exportToCanvas: any;
const loadExportToCanvas = async () => {
  if (!exportToCanvas) {
    const excalidraw = await import('@excalidraw/excalidraw');
    exportToCanvas = excalidraw.exportToCanvas;
  }
  return exportToCanvas;
};

import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types';

interface WhiteboardComponentProps {
  isActive: boolean;
  onStreamReady?: (stream: MediaStream) => void;
  onStreamStopped?: () => void;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * WhiteboardComponent
 * 
 * Excalidraw를 감싸고 캔버스 스트리밍을 처리하는 메인 화이트보드 컴포넌트
 * 이 컴포넌트는 다음을 수행합니다:
 * 1. Excalidraw 화이트보드 렌더링
 * 2. 캔버스를 비디오 스트림으로 캡처
 * 3. LiveKit 게시를 위해 부모에게 스트림 제공
 * 
 * @param isActive - 화이트보드가 현재 활성화되어 있는지 여부
 * @param onStreamReady - 스트림이 준비되었을 때의 콜백
 * @param onStreamStopped - 스트림이 중지되었을 때의 콜백
 * @param onCanvasReady - 캔버스가 캡처 준비되었을 때의 콜백
 */
const WhiteboardComponent: React.FC<WhiteboardComponentProps> = ({
  isActive,
  onStreamReady,
  onStreamStopped,
  onCanvasReady,
  className = '',
  style = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const excalidrawRef = useRef<ExcalidrawImperativeAPI>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const mutationObserverRef = useRef<MutationObserver | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // captureIntervalRef 제거 - 한 번만 캡처하므로 더 이상 필요 없음

  // captureCanvasStream 함수 제거 - useEffect에서 직접 처리
  // 이렇게 하면 더 효율적이고 불필요한 함수 호출을 피할 수 있음

  // Force Excalidraw to recalculate bounds when container size/position changes
  useEffect(() => {
    if (!containerRef.current || !isActive) return;

    // Debounce function to prevent too many resize events
    const triggerResize = () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(() => {
        if (containerRef.current) {
          // Use requestAnimationFrame to ensure DOM has updated
          requestAnimationFrame(() => {
            // Trigger a window resize event to force Excalidraw to recalculate
            window.dispatchEvent(new Event('resize'));
            
            // Also try to update Excalidraw's scene bounds directly
            try {
              const canvas = containerRef.current?.querySelector('canvas');
              if (canvas) {
                // Force canvas to recalculate by accessing its bounding rect
                const rect = canvas.getBoundingClientRect();
                
                // If Excalidraw API is available, try to update it
                if (excalidrawRef.current) {
                  // Excalidraw should handle this automatically, but triggering resize helps
                  // Some versions of Excalidraw listen to window resize events
                }
              }
            } catch (e) {
              // Ignore errors
            }
          });
        }
      }, 100); // Debounce to 100ms
    };

    // Create ResizeObserver to detect layout changes (thumbnail open/close, window resize, etc.)
    resizeObserverRef.current = new ResizeObserver(() => {
      triggerResize();
    });

    // Observe the container and its parent to catch layout changes
    resizeObserverRef.current.observe(containerRef.current);
    
    // Also observe parent container if it exists (catches thumbnail panel changes)
    const parent = containerRef.current.parentElement;
    if (parent) {
      resizeObserverRef.current.observe(parent);
    }

    // Also listen to window resize and layout changes
    const handleResize = () => {
      if (excalidrawRef.current && containerRef.current) {
        requestAnimationFrame(() => {
          window.dispatchEvent(new Event('resize'));
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Also use MutationObserver to detect DOM changes (thumbnail panel visibility changes)
    mutationObserverRef.current = new MutationObserver((mutations) => {
      // Check if any mutation affects layout (thumbnail panel opening/closing)
      const hasLayoutChange = mutations.some(mutation => {
        // Check if the mutation is related to participant thumbnails or affects layout
        const target = mutation.target as HTMLElement;
        if (target && (
          target.classList?.contains('participant-thumbnails') ||
          target.closest('.participant-thumbnails') ||
          mutation.type === 'attributes' && (
            mutation.attributeName === 'style' || 
            mutation.attributeName === 'class'
          )
        )) {
          return true;
        }
        return false;
      });

      if (hasLayoutChange) {
        triggerResize();
      }
    });

    // Observe the document body for changes that might affect layout
    if (typeof document !== 'undefined') {
      mutationObserverRef.current.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    }

    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
        resizeTimeoutRef.current = null;
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
        mutationObserverRef.current = null;
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [isActive]);

  // 스트리밍 시작 - Excalidraw가 준비될 때까지 대기
  // 중요: captureStream()은 캔버스당 한 번만 호출하면 됨
  // MediaStream은 캔버스가 변경될 때 자동으로 업데이트됨 - interval 불필요!
  useEffect(() => {
    if (!isActive) {
      // 화이트보드가 비활성화되면 스트림 정리
      if (stream) {
        stream.getTracks().forEach(track => {
          if (track && typeof track.stop === 'function') {
            track.stop();
          }
        });
        setStream(null);
        setIsStreaming(false);
        onStreamStopped?.();
      }
      return;
    }

    // 중요 수정: 스트림이 이미 존재하면 재초기화 방지
    if (stream && isStreaming) {
      return;
    }

    // Excalidraw 초기화 대기 - ref가 설정되었는지 확인
    let retryCount = 0;
    const maxRetries = 10; // 더 빠른 응답을 위해 5초로 단축 (10 * 500ms)
    let isMounted = true;
    
    const checkExcalidrawReady = async () => {
      // 컴포넌트가 여전히 마운트되어 있는지 확인
      if (!isMounted) return;
      
      // Excalidraw ref가 준비되고 컨테이너에 캔버스가 있는지 확인
      if (excalidrawRef.current && containerRef.current) {
        // Excalidraw가 렌더링되었는지 캔버스를 찾아서 확인
        const canvasElement = containerRef.current.querySelector('canvas');
        
        if (canvasElement && canvasElement.captureStream) {
          // 스트림을 한 번만 캡처 - 캔버스가 변경될 때 자동으로 업데이트됨
          // interval이나 반복 캡처 불필요!
          try {
            const mediaStream = canvasElement.captureStream(30); // 30fps
            
            if (mediaStream && mediaStream.active && isMounted) {
              setStream(mediaStream);
              setIsStreaming(true);
              onCanvasReady?.(canvasElement);
              onStreamReady?.(mediaStream);
              
              // 중요 수정: 주기적인 최소 업데이트로 스트림 유지
              // Canvas captureStream은 유휴 상태일 때 프레임 생성을 중지하여 검은 화면 발생 가능
              // 스트림을 활성 상태로 유지하기 위해 주기적으로 다시 그리기 강제
              const videoTrack = mediaStream.getVideoTracks()[0];
              if (videoTrack && videoTrack.readyState === 'live') {
                // 기존 interval 정리
                if (keepAliveIntervalRef.current) {
                  clearInterval(keepAliveIntervalRef.current);
                }
                
                // 스트림을 활성 상태로 유지하기 위해 100ms마다 캔버스 다시 그리기 강제
                // 검은 화면을 유발하는 10초 타임아웃보다 빠름
                keepAliveIntervalRef.current = setInterval(() => {
                  if (canvasElement && isMounted && isActive) {
                    const ctx = (canvasElement as HTMLCanvasElement).getContext('2d');
                    if (ctx && videoTrack.readyState === 'live') {
                      // 스트림을 활성 상태로 유지하는 최소 작업
                      // 단일 픽셀을 읽어서 다시 쓰기 (시각적 출력 변경 없음)
                      try {
                        const imageData = ctx.getImageData(0, 0, 1, 1);
                        ctx.putImageData(imageData, 0, 0);
                      } catch (e) {
                        // 오류 무시 - 캔버스가 잠겨 있을 수 있음
                      }
                    } else if (videoTrack.readyState !== 'live') {
                      // 트랙 종료, interval 정리
                      if (keepAliveIntervalRef.current) {
                        clearInterval(keepAliveIntervalRef.current);
                        keepAliveIntervalRef.current = null;
                      }
                    }
                  }
                }, 100); // 10초 타임아웃 방지를 위해 100ms마다
              }
            } else {
              throw new Error('스트림이 활성화되지 않음');
            }
          } catch (error: any) {
            console.error('[WhiteboardComponent] 스트림 캡처 실패:', error);
            if (retryCount < maxRetries && isMounted) {
              retryCount++;
              setTimeout(checkExcalidrawReady, 500);
            }
          }
        } else if (retryCount < maxRetries && isMounted) {
          // 캔버스가 아직 준비되지 않음, 재시도
          retryCount++;
          setTimeout(checkExcalidrawReady, 500);
        } else if (isMounted) {
          console.error('[WhiteboardComponent] 최대 재시도 후에도 Excalidraw 캔버스를 찾을 수 없음');
        }
      } else if (retryCount < maxRetries && isMounted) {
        // Refs가 아직 준비되지 않음, 재시도
        retryCount++;
        setTimeout(checkExcalidrawReady, 500);
      } else if (isMounted) {
        console.error('[WhiteboardComponent] 최대 재시도 후에도 Excalidraw refs를 사용할 수 없음');
      }
    };

    // 즉시 확인 시작 (더 빠른 응답을 위해 지연 시간 단축)
    const initTimeout = setTimeout(checkExcalidrawReady, 200);

    return () => {
      isMounted = false;
      clearTimeout(initTimeout);
      
      // 중요 수정: keep-alive interval 정리
      if (keepAliveIntervalRef.current) {
        clearInterval(keepAliveIntervalRef.current);
        keepAliveIntervalRef.current = null;
      }
      
      // 언마운트 시 정리
      if (stream) {
        stream.getTracks().forEach(track => {
          if (track && typeof track.stop === 'function') {
            track.stop();
          }
        });
      }
    };
  }, [isActive]); // 중요 수정: 루프 방지를 위해 의존성에서 onStreamReady, onStreamStopped, onCanvasReady 제거

  if (!isActive) {
    return null;
  }

  // Detect mobile device
  const isMobile = typeof window !== 'undefined' && (window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));

  return (
    <div
      ref={containerRef}
      className={`whiteboard-container ${className}`}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#ffffff',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        // ✅ MOBILE FIX: Remove fixed min dimensions on mobile for proper responsiveness
        minWidth: isMobile ? '0' : '800px',
        minHeight: isMobile ? '0' : '600px',
        // Ensure coordinate system is always correct
        transform: 'translateZ(0)', // Force GPU acceleration for better coordinate accuracy
        ...style,
      }}
    >
      <div style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        // ✅ MOBILE FIX: Remove fixed min dimensions on mobile
        minHeight: isMobile ? '0' : '600px',
        minWidth: isMobile ? '0' : '800px'
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          flex: 1
        }}>
          <Excalidraw
            ref={(api) => {
              // Excalidraw가 준비되면 ref 설정
              if (api) {
                excalidrawRef.current = api;
                
                // Force recalculation of bounds when Excalidraw is ready
                // This ensures correct coordinate system on initial load
                requestAnimationFrame(() => {
                  window.dispatchEvent(new Event('resize'));
                });
              }
            }}
            onChange={(elements, appState) => {
              // 중요 수정: 유휴 상태에서도 스트림을 활성 상태로 유지하기 위해 캔버스 다시 그리기 강제
              // 이렇게 하면 비활성 상태 후 스트림이 검은 화면으로 변하는 것을 방지
              if (containerRef.current) {
                const canvasElement = containerRef.current.querySelector('canvas');
                if (canvasElement && stream) {
                  // 스트림을 활성 상태로 유지하기 위해 최소한의 다시 그리기 강제
                  // canvas.captureStream()은 계속 프레임을 생성함
                  const ctx = (canvasElement as HTMLCanvasElement).getContext('2d');
                  if (ctx) {
                    // 시각적 출력에 영향을 주지 않는 작은 다시 그리기 트리거
                    // 이것이 스트림을 활성 상태로 유지함
                    const imageData = ctx.getImageData(0, 0, 1, 1);
                    ctx.putImageData(imageData, 0, 0);
                  }
                }
              }
            }}
            // 호스트가 그릴 수 있도록 보기 모드 비활성화
            viewModeEnabled={false}
            // 모든 도구를 표시하기 위해 zen 모드 끄기
            zenModeEnabled={false}
            // 그리드 모드 비활성화
            gridModeEnabled={false}
            // 모든 UI 요소와 도구 활성화
            UIOptions={{
              canvasActions: {
                saveToActiveFile: false,
                loadScene: false,
                export: false,
              },
            }}
            // 모든 도구가 보이도록 보장
            renderTopRightUI={() => null}
            renderCustomStats={() => null}
            // 더 나은 가시성을 위해 테마를 밝게 설정
            theme="light"
          />
        </div>
      </div>
    </div>
  );
};

export default WhiteboardComponent;

