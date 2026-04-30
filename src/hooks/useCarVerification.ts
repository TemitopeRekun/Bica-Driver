import { useState, useCallback } from 'react';
import { CameraSource, CameraDirection } from '@capacitor/camera';
import { CapacitorService } from '@/services/CapacitorService';
import { api } from '@/services/api.service';
import { useUIStore } from '@/stores/uiStore';

export type CarSide = 'FRONT' | 'RIGHT' | 'BACK' | 'LEFT';

export const useCarVerification = (tripId: string) => {
  const { addToast } = useUIStore();
  const [conditionStep, setConditionStep] = useState<CarSide>('FRONT');
  const [carPhotos, setCarPhotos] = useState<Record<string, string>>({});
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const sides: CarSide[] = ['FRONT', 'RIGHT', 'BACK', 'LEFT'];

  const handleSnap = useCallback((side: CarSide) => {
    if (isCapturing) return;

    // 🛡️ Call takePhoto immediately to preserve User Gesture context
    CapacitorService.takePhoto(CameraSource.Camera, CameraDirection.Rear)
      .then(async (base64) => {
        if (!base64) return;

        setIsCapturing(true);
        try {
          const { url } = await api.post<{ url: string }>('/rides/upload-photo', { 
            image: base64, 
            folder: `condition/${tripId}/${side.toLowerCase()}` 
          });
          
          setCarPhotos(prev => ({ ...prev, [side]: url }));
          
          // Auto-advance to next side if available
          const currentIndex = sides.indexOf(side);
          if (currentIndex < sides.length - 1) {
            setConditionStep(sides[currentIndex + 1]);
          }
        } catch (error: any) {
          addToast('Failed to upload photo. Please try again.', 'error');
        } finally {
          setIsCapturing(false);
        }
      })
      .catch(() => {
        addToast('Could not open camera.', 'error');
      });
  }, [tripId, addToast, sides, isCapturing]);

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
