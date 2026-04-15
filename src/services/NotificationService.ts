
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { api } from './api.service';

export interface NotificationPayload {
  type: 'ride_assigned' | 'new_ride_request' | 'dispatch_failed' | string;
  tripId?: string;
  [key: string]: any;
}

type NotificationListener = (payload: NotificationPayload) => void;

class NotificationService {
  private listeners: Set<NotificationListener> = new Set();
  private currentToken: string | null = null;
  private isInitialized = false;

  async init() {
    if (this.isInitialized || Capacitor.getPlatform() === 'web') {
      return;
    }

    try {
      await this.addListeners();
      await this.requestPermissions();
      this.isInitialized = true;
    } catch (e) {
      console.warn('Push notification initialization failed', e);
    }
  }

  private async requestPermissions() {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt') {
      perm = await PushNotifications.requestPermissions();
    }

    if (perm.receive === 'granted') {
      await PushNotifications.register();
    }
  }

  private async addListeners() {
    await PushNotifications.addListener('registration', (token: Token) => {
      this.currentToken = token.value;
      console.log('Push registration success, token: ' + token.value);
      this.syncTokenWithBackend();
    });

    await PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Push registration error: ' + JSON.stringify(error));
    });

    await PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('Push received: ' + JSON.stringify(notification));
        const payload = this.parseNotification(notification);
        this.notifyListeners(payload);
      }
    );

    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (notification: ActionPerformed) => {
        console.log('Push action performed: ' + JSON.stringify(notification));
        const payload = this.parseNotification(notification.notification);
        this.notifyListeners(payload);
      }
    );
  }

  private parseNotification(notification: PushNotificationSchema): NotificationPayload {
    // Map data fields from FCM payload
    const data = notification.data || {};
    return {
      type: data.type || 'unknown',
      tripId: data.tripId || data.id,
      ...data
    };
  }

  private notifyListeners(payload: NotificationPayload) {
    this.listeners.forEach(listener => listener(payload));
  }

  addListener(listener: NotificationListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async getToken(): Promise<string | null> {
    if (this.currentToken) return this.currentToken;
    if (Capacitor.getPlatform() === 'web') return null;
    
    // If not registered yet, this might return null. 
    // Usually handled by the 'registration' listener.
    return this.currentToken;
  }

  async syncTokenWithBackend() {
    const token = await this.getToken();
    if (!token) return;

    try {
      const deviceType = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
      await api.patch('/users/fcm-token', {
        token,
        deviceType
      });
      console.log('FCM token synced with backend successfully');
    } catch (error) {
      console.warn('Failed to sync FCM token with backend', error);
    }
  }
}

export const notificationService = new NotificationService();
