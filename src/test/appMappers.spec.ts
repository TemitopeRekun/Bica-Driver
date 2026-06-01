import { describe, it, expect } from 'vitest';
import { mapUser, mapTrip } from '../mappers/appMappers';

describe('mapUser', () => {
  it('maps backend user to UserProfile', () => {
    const backendUser = {
      id: '123',
      name: 'John',
      email: 'john@test.com',
      phone: '08012345678',
      role: 'DRIVER',
      totalTrips: 5,
      avatarUrl: 'https://example.com/avatar.jpg',
      walletBalance: 1000,
      approvalStatus: 'APPROVED',
    };

    const result = mapUser(backendUser);
    expect(result.id).toBe('123');
    expect(result.name).toBe('John');
    expect(result.trips).toBe(5);
    expect(result.avatar).toBe('https://example.com/avatar.jpg');
    expect(result.walletBalance).toBe(1000);
    expect(result.approvalStatus).toBe('APPROVED');
  });

  it('falls back to selfieImageUrl when avatarUrl is missing', () => {
    const backendUser = {
      id: '1', name: 'Jane', email: 'j@t.com', phone: '000',
      role: 'DRIVER', selfieImageUrl: 'https://example.com/selfie.jpg',
    };
    const result = mapUser(backendUser);
    expect(result.avatar).toBe('https://example.com/selfie.jpg');
  });

  it('sets trips to 0 when totalTrips is missing', () => {
    const backendUser = {
      id: '1', name: 'J', email: 'j@t.com', phone: '000', role: 'OWNER',
    };
    const result = mapUser(backendUser);
    expect(result.trips).toBe(0);
  });

  it('maps location when lat/lng present', () => {
    const backendUser = {
      id: '1', name: 'J', email: 'j@t.com', phone: '000', role: 'DRIVER',
      locationLat: 6.45, locationLng: 3.39,
    };
    const result = mapUser(backendUser);
    expect(result.currentLocation).toEqual({ lat: 6.45, lng: 3.39 });
  });

  it('leaves location undefined when missing', () => {
    const backendUser = {
      id: '1', name: 'J', email: 'j@t.com', phone: '000', role: 'OWNER',
    };
    const result = mapUser(backendUser);
    expect(result.currentLocation).toBeUndefined();
  });
});

describe('mapTrip', () => {
  it('maps backend trip with nested owner/driver', () => {
    const backendTrip = {
      id: 't1',
      owner: { id: 'o1', name: 'Owner' },
      driver: { id: 'd1', name: 'Driver' },
      createdAt: '2026-06-01T12:00:00Z',
      pickupAddress: 'Point A',
      destAddress: 'Point B',
    };

    const result = mapTrip(backendTrip);
    expect(result.ownerId).toBe('o1');
    expect(result.driverId).toBe('d1');
    expect(result.ownerName).toBe('Owner');
    expect(result.driverName).toBe('Driver');
    expect(result.date).toBeTruthy();
  });
});
