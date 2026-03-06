import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  channelId?: string;
}

class NotificationService {
  private initialized = false;
  private permissionGranted = false;

  /**
   * Initialize notification service - call this on app startup
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return this.permissionGranted;

    try {
      // Request permissions
      await this.requestPermissions();

      // Register for push notifications on mobile
      if (this.isMobilePlatform()) {
        await this.registerPushNotifications();
      }

      // Setup notification channels (Android)
      if (Capacitor.getPlatform() === 'android') {
        await this.createNotificationChannels();
      }

      // Add local notification action listener (for all platforms)
      LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
        console.log('Local notification action (global):', notification);
        this.handleNotificationTap(notification.notification.extra);
      });

      this.initialized = true;
      console.log('✅ Notification service initialized');
      return this.permissionGranted;
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
      return false;
    }
  }

  /**
   * Request notification permissions
   */
  private async requestPermissions(): Promise<void> {
    try {
      // Local notifications permission
      const localPermResult = await LocalNotifications.requestPermissions();
      console.log('Local notification permission:', localPermResult.display);

      // Push notifications permission (mobile only)
      if (this.isMobilePlatform()) {
        const pushPermResult = await PushNotifications.requestPermissions();
        console.log('Push notification permission:', pushPermResult.receive);
        this.permissionGranted = pushPermResult.receive === 'granted';
      } else {
        this.permissionGranted = localPermResult.display === 'granted';
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      throw error;
    }
  }

  /**
   * Register for push notifications (mobile only)
   */
  private async registerPushNotifications(): Promise<void> {
    try {
      await PushNotifications.register();

      // Listen for registration success
      PushNotifications.addListener('registration', (token) => {
        console.log('Push registration success, token:', token.value);
        // TODO: Send this token to your backend to store it
        this.savePushToken(token.value);
      });

      // Listen for registration errors
      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error:', error);
      });

      // Listen for incoming push notifications
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push notification received:', notification);
        // Show local notification when app is in foreground
        this.showLocalNotification({
          title: notification.title || 'New notification',
          body: notification.body || '',
          data: notification.data,
        });
      });

      // Listen for notification actions
      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push notification action:', notification);
        // Handle notification tap - navigate to relevant screen
        this.handleNotificationTap(notification.notification.data);
      });
    } catch (error) {
      console.error('Error registering push notifications:', error);
      throw error;
    }
  }

  /**
   * Create notification channels for Android
   */
  private async createNotificationChannels(): Promise<void> {
    try {
      await LocalNotifications.createChannel({
        id: 'chat-messages',
        name: 'Chat Messages',
        description: 'Notifications for new chat messages',
        importance: 5, // MAX
        visibility: 1, // PUBLIC
        sound: 'default',
        vibration: true,
      });

      await LocalNotifications.createChannel({
        id: 'mentions',
        name: 'Mentions',
        description: 'Notifications when you are mentioned',
        importance: 5,
        visibility: 1,
        sound: 'default',
        vibration: true,
      });

      await LocalNotifications.createChannel({
        id: 'system',
        name: 'System',
        description: 'System notifications',
        importance: 3, // DEFAULT
        visibility: 1,
        sound: 'default',
      });
    } catch (error) {
      console.error('Error creating notification channels:', error);
    }
  }

  /**
   * Show a local notification
   */
  async showLocalNotification(payload: NotificationPayload): Promise<void> {
    if (!this.permissionGranted) {
      console.warn('Notification permission not granted');
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: payload.title,
            body: payload.body,
            id: Date.now(),
            schedule: { at: new Date(Date.now() + 100) }, // Show immediately
            sound: 'default',
            attachments: undefined,
            actionTypeId: '',
            extra: payload.data,
            channelId: payload.channelId || 'chat-messages',
          },
        ],
      });
    } catch (error) {
      console.error('Error showing local notification:', error);
    }
  }

  /**
   * Show notification for new chat message
   */
  async showChatNotification(
    senderName: string,
    message: string,
    chatId: string,
    chatName?: string
  ): Promise<void> {
    await this.showLocalNotification({
      title: chatName ? `${senderName} in ${chatName}` : senderName,
      body: message,
      channelId: 'chat-messages',
      data: {
        type: 'chat-message',
        chatId,
        senderName,
      },
    });
  }

  /**
   * Show notification for mention
   */
  async showMentionNotification(
    senderName: string,
    message: string,
    chatId: string
  ): Promise<void> {
    await this.showLocalNotification({
      title: `${senderName} mentioned you`,
      body: message,
      channelId: 'mentions',
      data: {
        type: 'mention',
        chatId,
        senderName,
      },
    });
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(): Promise<void> {
    try {
      await LocalNotifications.cancel({ notifications: [] });

      if (this.isMobilePlatform()) {
        await PushNotifications.removeAllDeliveredNotifications();
      }
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }

  /**
   * Save push token to backend
   */
  private async savePushToken(token: string): Promise<void> {
    try {
      // Store token in localStorage for web push
      localStorage.setItem('push_token', token);
      localStorage.setItem('push_token_platform', Capacitor.getPlatform());

      // TODO: Uncomment this when push_tokens table is created in Supabase
      // const { supabase } = await import('../lib/supabase');
      // const { data: { user } } = await supabase.auth.getUser();
      // if (!user) return;
      //
      // await supabase.from('push_tokens').upsert({
      //   user_id: user.id,
      //   token: token,
      //   platform: Capacitor.getPlatform(),
      //   updated_at: new Date().toISOString(),
      // }, {
      //   onConflict: 'user_id,platform'
      // });

      console.log('✅ Push token saved:', token.slice(0, 20) + '...');
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }

  /**
   * Handle notification tap
   */
  private handleNotificationTap(data: any): void {
    console.log('Handling notification tap:', data);

    // Navigate to the relevant chat
    if (data?.type === 'chat-message' || data?.type === 'mention') {
      const chatId = data.chatId || data.conversation_id;
      if (chatId) {
        console.log(`✅ Navigating to chat: ${chatId}`);
        // Use window.location to navigate (works across all platforms)
        window.location.href = `/conversations/${chatId}`;
      }
    }
  }

  /**
   * Check if running on mobile platform
   */
  private isMobilePlatform(): boolean {
    const platform = Capacitor.getPlatform();
    return platform === 'ios' || platform === 'android';
  }

  /**
   * Check if running on desktop platform
   */
  isDesktopPlatform(): boolean {
    return Capacitor.getPlatform() === 'electron';
  }

  /**
   * Check if running in web browser
   */
  isWebPlatform(): boolean {
    return Capacitor.getPlatform() === 'web';
  }

  /**
   * Get current platform
   */
  getPlatform(): string {
    return Capacitor.getPlatform();
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
