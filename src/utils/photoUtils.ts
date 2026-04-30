import { CapacitorService } from '@/services/CapacitorService';
import { api } from '@/services/api.service';
import { CameraSource, CameraDirection } from '@capacitor/camera';

export interface PhotoUploadResult {
  url: string;
  side?: string;
}

/**
 * Handles the end-to-end pipeline of taking a photo and uploading it.
 * Optimized for memory by avoiding keeping multiple high-res base64 strings in component state.
 */
export async function snapAndUpload(
  source: CameraSource,
  direction: CameraDirection,
  folder: string,
  onProgress?: (status: 'CAPTURING' | 'UPLOADING' | 'DONE' | 'ERROR') => void
): Promise<string> {
  try {
    onProgress?.('CAPTURING');
    const base64 = await CapacitorService.takePhoto(source, direction);
    
    if (!base64) throw new Error('Photo capture cancelled');

    onProgress?.('UPLOADING');
    // We upload immediately to keep memory footprint low in the component
    const { url } = await api.post<{ url: string }>('/rides/upload-photo', { 
      image: base64, 
      folder: folder 
    });

    onProgress?.('DONE');
    return url;
  } catch (error) {
    onProgress?.('ERROR');
    throw error;
  }
}

/**
 * Resilient batch upload for multiple photos (e.g. car condition)
 * Uses Promise.allSettled to allow for partial successes and retries.
 */
export async function uploadPhotoBatch(
  photos: { side: string; base64: string }[],
  baseFolder: string
): Promise<PhotoUploadResult[]> {
  const uploadPromises = photos.map(async (p) => {
    const { url } = await api.post<{ url: string }>('/rides/upload-photo', { 
      image: p.base64, 
      folder: `${baseFolder}/${p.side.toLowerCase()}` 
    });
    return { url, side: p.side };
  });

  const results = await Promise.allSettled(uploadPromises);
  
  const successful = results
    .filter((r): r is PromiseFulfilledResult<{ url: string; side: string }> => r.status === 'fulfilled')
    .map(r => r.value as PhotoUploadResult);

  const failures = results.filter(r => r.status === 'rejected');
  
  if (failures.length > 0) {
    throw new Error(`${failures.length} photos failed to upload. Please try again.`);
  }

  return successful;
}
