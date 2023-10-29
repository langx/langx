import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
  RegistrationError,
} from '@capacitor/push-notifications';
import { NavigationExtras, Router } from '@angular/router';
import { ApiService } from '../api/api.service';

@Injectable({
  providedIn: 'root',
})
export class FcmService {
  constructor(private router: Router, private api: ApiService) {}

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
      // TODO: It may handle in api.service.ts
      console.log('My token: ' + JSON.stringify(token));
      this.api.account.getPrefs().then((prefs) => {
        console.log(prefs);
        if (prefs['ios'] !== '') {
          if (prefs['ios'] !== token.value) {
            prefs['ios'] = token.value;
            this.api.account
              .updatePrefs(prefs)
              .then((res) => {
                console.log('ios token updated', res);
              })
              .catch((err) => {
                console.log('ios token update error', err);
              });
          }
        }
      });
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
        console.log('Push action performed: ' + JSON.stringify(notification));
        console.log(
          'Action performed: ' + JSON.stringify(notification.notification)
        );
        const data = notification.notification.data;
        if (data.roomId) {
          // TODO: #231 No need Room navData
          // Redirect to chat page
          const navData: NavigationExtras = {
            queryParams: {
              name: 'user?.name',
              uid: 'user?.$id',
            },
          };
          this.router.navigate(['/', 'home', 'chat', data.roomId], navData);
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
