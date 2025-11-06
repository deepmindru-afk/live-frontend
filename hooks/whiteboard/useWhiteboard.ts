import { useState, useCallback, useRef, useEffect } from 'react';
import { LocalVideoTrack, Track } from 'livekit-client';
import { LiveKitService } from '../../lib/livekit-service';

interface UseWhiteboardOptions {
  meetingId: string;
  isHost: boolean;
  liveKitService: LiveKitService | null;
  onStreamReady?: (stream: MediaStream) => void;
  onStreamStopped?: () => void;
  onWhiteboardStateChange?: (isActive: boolean) => void;
}

interface UseWhiteboardReturn {
  isWhiteboardActive: boolean;
  isStreaming: boolean;
  startWhiteboard: (stream: MediaStream) => Promise<void>;
  stopWhiteboard: () => Promise<void>;
  clearWhiteboard: () => void;
  whiteboardStream: MediaStream | null;
  publishedTrack: LocalVideoTrack | null;
  error: string | null;
}

/**
 * useWhiteboard Hook
 * 
 * 화이트보드 상태 및 LiveKit 스트리밍을 관리하는 메인 훅
 * 다음을 처리합니다:
 * - 화이트보드 활성/비활성 상태
 * - 캔버스 스트림 캡처
 * - LiveKit 트랙 게시
 * - 호스트 권한 확인
 */
export const useWhiteboard = ({
  meetingId,
  isHost,
  liveKitService,
  onStreamReady,
  onStreamStopped,
  onWhiteboardStateChange,
}: UseWhiteboardOptions): UseWhiteboardReturn => {
  const [isWhiteboardActive, setIsWhiteboardActive] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [whiteboardStream, setWhiteboardStream] = useState<MediaStream | null>(null);
  const [publishedTrack, setPublishedTrack] = useState<LocalVideoTrack | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (whiteboardStream) {
        whiteboardStream.getTracks().forEach(track => {
          if (track && typeof track.stop === 'function') {
            track.stop();
          }
        });
      }
      if (publishedTrack && typeof publishedTrack.stop === 'function') {
        publishedTrack.stop();
      }
    };
  }, [whiteboardStream, publishedTrack]);

  const startWhiteboard = useCallback(async (stream: MediaStream) => {
    if (!isHost) {
      console.warn('[useWhiteboard] 호스트가 아니므로 화이트보드를 시작할 수 없음');
      setError('호스트만 화이트보드를 사용할 수 있습니다');
      return;
    }

    if (!liveKitService?.room) {
      console.error('[useWhiteboard] LiveKit 방에 연결되지 않음');
      setError('LiveKit 방에 연결되지 않았습니다');
      return;
    }

    try {
      setError(null);
      
      // 중요 수정: 화이트보드를 게시하기 전에 기존 화면 공유 트랙 게시 취소
      // 이렇게 하면 "같은 소스로 두 번째 트랙 게시" 오류를 방지
      const existingScreenSharePublications = Array.from(liveKitService.room.localParticipant.videoTrackPublications.values())
        .filter(pub => {
          const source = pub.source || pub.track?.source;
          return source === Track.Source.ScreenShare;
        });
      
      // 기존 화면 공유 트랙 모두 게시 취소
      for (const pub of existingScreenSharePublications) {
        if (pub.track) {
          try {
            await liveKitService.room.localParticipant.unpublishTrack(pub.track);
            // 중요 수정: 호출 전에 트랙이 존재하고 stop 메서드가 있는지 확인
            if (pub.track && typeof pub.track.stop === 'function') {
              pub.track.stop();
            }
          } catch (err: any) {
            console.warn('[useWhiteboard] 기존 트랙 게시 취소 오류:', err);
            // 계속 진행 - 트랙이 이미 중지되었을 수 있음
          }
        }
      }
      
      // 게시 취소가 완료될 때까지 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 스트림에서 비디오 트랙 가져오기
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('스트림에서 비디오 트랙을 찾을 수 없음');
      }

      // MediaStreamTrack에서 LocalVideoTrack 생성
      // LocalVideoTrack은 기존 MediaStreamTrack에서 생성 가능
      const localVideoTrack = new LocalVideoTrack(videoTrack, {
        name: 'whiteboard',
        source: Track.Source.ScreenShare,
      });

      // LiveKit 방에 화면 공유로 트랙 게시
      const publication = await liveKitService.room.localParticipant.publishTrack(localVideoTrack, {
        source: Track.Source.ScreenShare,
      });

      setWhiteboardStream(stream);
      setPublishedTrack(localVideoTrack);
      setIsWhiteboardActive(true);
      setIsStreaming(true);
      onStreamReady?.(stream);
      onWhiteboardStateChange?.(true);
      
    } catch (err: any) {
      console.error('[useWhiteboard] 화이트보드 시작 실패:', err);
      setError(err.message || '화이트보드 시작 실패');
      setIsWhiteboardActive(false);
      setIsStreaming(false);
      
      // 오류 발생 시 정리
      if (stream) {
        stream.getTracks().forEach(track => {
          if (track && typeof track.stop === 'function') {
            track.stop();
          }
        });
      }
    }
  }, [isHost, liveKitService, onStreamReady, onWhiteboardStateChange]);

  const stopWhiteboard = useCallback(async () => {
    try {
      // LiveKit 트랙 중지
      if (liveKitService?.room && publishedTrack) {
        try {
          await liveKitService.room.localParticipant.unpublishTrack(publishedTrack);
        } catch (err: any) {
          console.warn('[useWhiteboard] 트랙 게시 취소 오류:', err);
        }
        // 중요 수정: 호출 전에 트랙이 존재하고 stop 메서드가 있는지 확인
        if (publishedTrack && typeof publishedTrack.stop === 'function') {
          publishedTrack.stop();
        }
        setPublishedTrack(null);
      }

      // 스트림 트랙 중지
      if (whiteboardStream) {
        whiteboardStream.getTracks().forEach(track => {
          if (track && typeof track.stop === 'function') {
            track.stop();
          }
        });
        setWhiteboardStream(null);
      }

      setIsWhiteboardActive(false);
      setIsStreaming(false);
      onStreamStopped?.();
      onWhiteboardStateChange?.(false);
    } catch (err: any) {
      console.error('[useWhiteboard] 화이트보드 중지 실패:', err);
      setError(err.message || '화이트보드 중지 실패');
      
      // 게시 취소가 실패해도 강제 정리
      setIsWhiteboardActive(false);
      setIsStreaming(false);
      if (whiteboardStream) {
        whiteboardStream.getTracks().forEach(track => {
          if (track && typeof track.stop === 'function') {
            track.stop();
          }
        });
        setWhiteboardStream(null);
      }
      if (publishedTrack && typeof publishedTrack.stop === 'function') {
        publishedTrack.stop();
        setPublishedTrack(null);
      }
    }
  }, [liveKitService, whiteboardStream, publishedTrack, onStreamStopped, onWhiteboardStateChange]);

  const clearWhiteboard = useCallback(() => {
    // 이것은 WhiteboardComponent에서 처리됨
    // Excalidraw는 자체 지우기 기능이 있음
  }, []);

  return {
    isWhiteboardActive,
    isStreaming,
    startWhiteboard,
    stopWhiteboard,
    clearWhiteboard,
    whiteboardStream,
    publishedTrack,
    error,
  };
};

export default useWhiteboard;

