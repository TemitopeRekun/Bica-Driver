export enum UserRole {
  OWNER = 'OWNER',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
  UNSET = 'UNSET'
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  password?: string;       // only used locally during signup flow
  role: UserRole;
  rating: number;
  trips: number;           // maps to totalTrips from backend
  totalTrips?: number;     // backend field name
  avatar: string;          // maps to avatarUrl from backend
  avatarUrl?: string;      // backend field name
  walletBalance?: number;
  carType?: string;
  carModel?: string;
  carYear?: string;
  licenseImage?: string;
  licenseImageUrl?: string;
  selfieImage?: string;
  selfieImageUrl?: string;
  backgroundCheckAccepted?: boolean;
  approvalStatus?: ApprovalStatus;
  gender?: string;
  address?: string;
  nationality?: string;
  age?: string;
  nin?: string;
  ninImage?: string;
  ninImageUrl?: string;
  transmission?: 'Manual' | 'Automatic' | 'Both';
  isBlocked?: boolean;
  // Bank details — drivers only
  bankName?: string;
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
  monnifySubAccountCode?: string;
  // Location
  currentLocation?: { lat: number; lng: number };
  locationLat?: number;
  locationLng?: number;
}

export interface Trip {
  id: string;
  driverId?: string;
  ownerId?: string;
  driverName: string;
  ownerName: string;
  // Backend returns owner/driver as nested objects
  driver?: { id: string; name: string; avatarUrl?: string; phone?: string; rating?: number };
  owner?: { id: string; name: string; avatarUrl?: string; phone?: string };
  date: string;
  createdAt?: string;
  amount: number;
  distanceKm?: number;
  status: 'COMPLETED' | 'CANCELLED' | 'PENDING' | 'IN_PROGRESS' | 'ASSIGNED' | 'SEARCHING' | 'SCHEDULED';
  paymentStatus?: 'UNPAID' | 'PENDING' | 'PAID' | 'FAILED';
  location: string;
  pickupAddress?: string;
  destAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  destLat?: number;
  destLng?: number;
  estimatedArrivalMins?: number;
  driverEarnings?: number;
  commissionAmount?: number;
  monnifyTxRef?: string;
}

export interface Payout {
  id: string;
  driverId: string;
  driverName: string;
  amount: number;
  status: 'PENDING' | 'PAID';
  date: string;
}

export interface SystemSettings {
  baseFare: number;
  pricePerKm: number;
  commission: number;
  autoApprove: boolean;
}

export enum AppScreen {
  LOADING = 'LOADING',
  WELCOME = 'WELCOME',
  SIGN_UP = 'SIGN_UP',
  LOGIN = 'LOGIN',
  ROLE_SELECTION = 'ROLE_SELECTION',
  MAIN_REQUEST = 'MAIN_REQUEST',
  DRIVER_DASHBOARD = 'DRIVER_DASHBOARD',
  PROFILE = 'PROFILE',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD'
}