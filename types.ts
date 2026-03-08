
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
  password?: string;
  role: UserRole;
  rating: number;
  trips: number;
  avatar: string;
  walletBalance?: number;
  // Role specific fields
  carType?: string;
  licenseImage?: string;
  selfieImage?: string;
  backgroundCheckAccepted?: boolean;
  approvalStatus?: ApprovalStatus;
  
  // New Registration Fields
  gender?: string;
  address?: string;
  nationality?: string;
  age?: string;
  nin?: string;
  ninImage?: string;
  transmission?: 'Manual' | 'Automatic' | 'Both';
  isBlocked?: boolean;
  
  // Real-time location
  currentLocation?: {
    lat: number;
    lng: number;
  };
}

export interface Trip {
  id: string;
  driverId?: string;
  ownerId?: string;
  driverName: string;
  ownerName: string;
  date: string;
  amount: number;
  status: 'COMPLETED' | 'CANCELLED' | 'PENDING' | 'IN_PROGRESS';
  location: string;
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
