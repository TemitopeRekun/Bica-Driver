import { IMAGES } from '@/constants';
import { PaymentHistoryRecord, PendingPaymentTrip, Trip, UserProfile, UserRole } from '@/types';

export const mapUser = (backendUser: any): UserProfile => ({
  ...backendUser,
  trips: backendUser.totalTrips ?? 0,
  avatar: backendUser.avatarUrl || (backendUser.role === UserRole.DRIVER ? IMAGES.DRIVER_CARD : IMAGES.USER_AVATAR),
  licenseImage: backendUser.licenseImageUrl,
  selfieImage: backendUser.selfieImageUrl,
  ninImage: backendUser.ninImageUrl,
  bankName: backendUser.bankName,
  bankCode: backendUser.bankCode,
  accountName: backendUser.accountName,
  accountNumber: backendUser.accountNumber,
  monnifySubAccountCode: backendUser.monnifySubAccountCode,
  subAccountActive: backendUser.subAccountActive,
  canRetrySubAccountSetup: backendUser.canRetrySubAccountSetup,
  carType: backendUser.carType,
  carModel: backendUser.carModel,
  carYear: backendUser.carYear,
  transmission: backendUser.transmission,
  nin: backendUser.nin,
  age: backendUser.age,
  gender: backendUser.gender,
  nationality: backendUser.nationality,
  address: backendUser.address,
  currentLocation: backendUser.locationLat
    ? { lat: backendUser.locationLat, lng: backendUser.locationLng }
    : undefined,
});

export const mapTrip = (backendTrip: any): Trip => ({
  ...backendTrip,
  ownerId: backendTrip.ownerId || backendTrip.owner?.id,
  driverId: backendTrip.driverId || backendTrip.driver?.id,
  ownerName: backendTrip.owner?.name || backendTrip.ownerName || 'Owner',
  driverName: backendTrip.driver?.name || backendTrip.driverName || 'Unassigned',
  date: backendTrip.createdAt
    ? new Date(backendTrip.createdAt).toLocaleString()
    : backendTrip.date || '',
  location:
    backendTrip.location ||
    `${backendTrip.pickupAddress?.split(',')[0] || 'Unknown'} -> ${backendTrip.destAddress?.split(',')[0] || 'Unknown'}`,
});

export const mapPendingPaymentTrip = (backendTrip: any): PendingPaymentTrip => ({
  ...mapTrip(backendTrip),
  owner: backendTrip.owner,
  driver: backendTrip.driver,
});

export const mapPaymentHistory = (payment: any): PaymentHistoryRecord => ({
  ...payment,
  trip: payment.trip,
});

export const mapAvailableDriver = (driver: any): UserProfile => ({
  id: driver.id,
  name: driver.name,
  email: '',
  phone: '',
  role: UserRole.DRIVER,
  rating: driver.rating ?? 0,
  trips: driver.totalTrips ?? 0,
  totalTrips: driver.totalTrips ?? 0,
  avatar: driver.avatarUrl || IMAGES.DRIVER_CARD,
  avatarUrl: driver.avatarUrl || IMAGES.DRIVER_CARD,
  approvalStatus: 'APPROVED',
  isBlocked: false,
  isOnline: true,
  transmission: driver.transmission ?? undefined,
  currentLocation:
    driver.locationLat != null && driver.locationLng != null
      ? { lat: driver.locationLat, lng: driver.locationLng }
      : undefined,
  locationLat: driver.locationLat ?? undefined,
  locationLng: driver.locationLng ?? undefined,
});
