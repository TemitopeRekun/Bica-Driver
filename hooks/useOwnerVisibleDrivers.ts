import { useEffect, useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { api } from '../services/api.service';
import { mapAvailableDriver } from '../mappers/appMappers';

interface UseOwnerVisibleDriversOptions {
  enabled: boolean;
  role?: UserRole;
}

export const useOwnerVisibleDrivers = ({ enabled, role }: UseOwnerVisibleDriversOptions) => {
  const [ownerVisibleDrivers, setOwnerVisibleDrivers] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!enabled || role !== UserRole.OWNER) {
      setOwnerVisibleDrivers([]);
      return;
    }

    api.get<any[]>('/users/drivers/available')
      .then((drivers) => {
        setOwnerVisibleDrivers(drivers.map(mapAvailableDriver));
      })
      .catch((error: any) => {
        console.error('Failed to load owner-visible drivers:', error);
        setOwnerVisibleDrivers([]);
      });
  }, [enabled, role]);

  return {
    ownerVisibleDrivers,
  };
};
