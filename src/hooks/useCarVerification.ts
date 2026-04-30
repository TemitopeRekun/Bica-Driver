import { useState, useCallback } from 'react';
import { CameraSource, CameraDirection } from '@capacitor/camera';
import { snapAndUpload } from '@/utils/photoUtils';
import { useUIStore } from '@/stores/uiStore';

export type CarSide = 'FRONT' | 'RIGHT' | 'BACK' | 'LEFT';

export const useCarVerification = (tripId: string) => {
  const { addToast } = useUIStore();
  const [conditionStep, setConditionStep] = useState<CarSide>('FRONT');
  const [carPhotos, setCarPhotos] = useState<Record<string, string>>({});
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const sides: CarSide[] = ['FRONT', 'RIGHT', 'BACK', 'LEFT'];

  const handleSnap = useCallback(async (side: CarSide) => {
    try {
      const url = await snapAndUpload(
        CameraSource.Camera, 
        CameraDirection.Rear, 
        `condition/${tripId}`,
        (status) => setIsCapturing(status === 'CAPTURING' || status === 'UPLOADING')
      );
      
      if (url) {
        setCarPhotos(prev => ({ ...prev, [side]: url }));
        // Auto-advance to next side if available
        const currentIndex = sides.indexOf(side);
        if (currentIndex < sides.length - 1) {
          setConditionStep(sides[currentIndex + 1]);
        }
      }
    } catch (error: any) {
      if (error.message !== 'Photo capture cancelled') {
        addToast('Failed to upload photo. Please try again.', 'error');
      }
    }
  }, [tripId, addToast, sides]);

  const reset = useCallback(() => {
    setConditionStep('FRONT');
    setCarPhotos({});
  }, []);

  return {
    conditionStep,
    setConditionStep,
    carPhotos,
    isCapturing,
    isUploading,
    handleSnap,
    reset,
    isComplete: Object.keys(carPhotos).length === 4,
    sides
  };
};
