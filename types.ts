export enum UserRole {
  OWNER = 'OWNER',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
  UNSET = 'UNSET'
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type TripStatus =
  | 'PENDING'
  | 'SEARCHING'
  | 'PENDING_ACCEPTANCE'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'SCHEDULED'
  | 'DECLINED';

export type PaymentStatus = 'UNPAID' | 'PENDING' | 'PAID' | 'FAILED';

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
  isOnline?: boolean;
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
  createdAt?: string;
  updatedAt?: string;
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
  updatedAt?: string;
  completedAt?: string | null;
  startedAt?: string | null;
  scheduledAt?: string | null;
  amount: number;
  finalFare?: number | null;
  distanceKm?: number;
  status: TripStatus;
  paymentStatus?: PaymentStatus;
  location: string;
  pickupAddress?: string;
  destAddress?: string;
  pickupLat?: number;
  pickupLng?: number;
  destLat?: number;
  destLng?: number;
  estimatedArrivalMins?: number;
  estimatedMins?: number | null;
  driverEarnings?: number;
  commissionAmount?: number;
  monnifyTxRef?: string;
  fareBreakdown?: Record<string, unknown> | null;
}

export interface Payout {
  id: string;
  driverId: string;
  driverName: string;
  amount: number;
  status: 'PENDING' | 'PAID';
  date: string;
  bankName?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  requestedAt?: string;
  approvedAt?: string | null;
  tripId?: string | null;
  driver?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    walletBalance?: number;
  };
  trip?: {
    id: string;
    amount: number;
    status: TripStatus;
    createdAt: string;
  } | null;
}

export interface WalletSummary {
  name: string;
  currentBalance: number;
  totalEarned: number;
  totalTrips: number;
  bankName: string | null;
  accountNumber: string | null;
  subAccountActive: boolean;
  recentPayments: Array<{
    id: string;
    totalAmount: number;
    driverAmount: number;
    paidAt: string;
    paymentMethod: string | null;
  }>;
}

export interface PaymentHistoryRecord {
  id: string;
  tripId: string;
  totalAmount: number;
  driverAmount: number;
  platformAmount: number;
  monnifyTxRef: string;
  paymentMethod: string | null;
  paidAt: string;
  webhookPayload: Record<string, unknown>;
  createdAt: string;
  trip: {
    id: string;
    pickupAddress: string;
    destAddress: string;
    status: TripStatus;
    owner: {
      name: string;
    };
    driver: {
      name: string;
    } | null;
  };
}

export interface PendingPaymentTrip extends Trip {
  owner: {
    name: string;
    email: string;
    phone: string;
  };
  driver: {
    name: string;
  } | null;
}

export interface SystemSettings {
  baseFare: number;
  pricePerKm: number;
  timeRate?: number;
  commission: number;
  autoApprove: boolean;
  id?: number;
  updatedAt?: string;
  updatedById?: string | null;
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
