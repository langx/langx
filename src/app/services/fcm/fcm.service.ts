import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
  RegistrationError,
} from '@capacitor/push-notifications';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class FcmService {
  constructor(private router: Router) {}

  public initPush() {
    // TODO: #226 Web notification can also be implemented here
    if (Capacitor.getPlatform() !== 'web') {
      this.registerPush();
    }
  }

  private async registerPush() {
    // Check permission
    let permStatus = await PushNotifications.checkPermissions();

    if (
      permStatus.receive === 'prompt' ||
      permStatus.receive === 'prompt-with-rationale'
    ) {
      // Request permission
      permStatus = await PushNotifications.requestPermissions();
    }

    // Error if permission not granted
    if (permStatus.receive !== 'granted') {
      throw new Error('User denied permissions!');
    }

    // Register with Apple / Google to receive push via APNS/FCM
    await PushNotifications.register();

    // Listeners for registration, errors, and incoming notifications
    PushNotifications.addListener('registration', (token: Token) => {
      // TODO: Save this token to database!
      console.log('My token: ' + JSON.stringify(token));
    });

    PushNotifications.addListener(
      'registrationError',
      (error: RegistrationError) => {
        console.log('Error: ' + JSON.stringify(error));
      }
    );

    PushNotifications.addListener(
      'pushNotificationReceived',
      async (notification: PushNotificationSchema) => {
        console.log('Push received: ' + JSON.stringify(notification));
      }
    );

    PushNotifications.addListener(
      'pushNotificationActionPerformed',
      async (notification: ActionPerformed) => {
        const data = notification.notification.data;
        console.log(
          'Action performed: ' + JSON.stringify(notification.notification)
        );
        if (data.detailsId) {
          this.router.navigateByUrl(`/home/fcm-test/${data.detailsId}`);
        }
      }
    );
  }

  // Example method for managing push notifications
  async getDeliveredNotifications() {
    const notificationList =
      await PushNotifications.getDeliveredNotifications();
    console.log('delivered notifications', notificationList);
  }
}
