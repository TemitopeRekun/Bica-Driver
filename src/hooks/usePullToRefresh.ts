import { useState, useRef, useCallback } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export const usePullToRefresh = (onRefresh: () => Promise<void>) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const isThresholdMet = useRef(false);
  const THRESHOLD = 70; // px

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Only track if we are at the top of the scrollable container
    const scrollTop = e.currentTarget.scrollTop;
    if (scrollTop === 0) {
      startY.current = e.touches[0].pageY;
      isThresholdMet.current = false;
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === null || isRefreshing) return;

    const currentY = e.touches[0].pageY;
    const diff = currentY - startY.current;

    // Only allow pulling down
    if (diff > 0 && e.currentTarget.scrollTop === 0) {
      // Prevent default scroll behavior to avoid rubber-banding during pull
      // Note: In some browsers/environments, this might not be possible on the move event itself
      // but we use it here to indicate the pull state.
      
      if (diff >= THRESHOLD && !isThresholdMet.current) {
        isThresholdMet.current = true;
        if (Capacitor.isNativePlatform()) {
          Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
        }
      }
    }
  }, [isRefreshing]);

  const onTouchEnd = useCallback(async () => {
    if (startY.current === null || isRefreshing) {
      startY.current = null;
      return;
    }

    if (isThresholdMet.current) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } catch (e) {
        console.warn('[PullToRefresh] Refresh failed', e);
      } finally {
        setIsRefreshing(false);
      }
    }

    startY.current = null;
    isThresholdMet.current = false;
  }, [isRefreshing, onRefresh]);

  return {
    isRefreshing,
    pullHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    }
  };
};
