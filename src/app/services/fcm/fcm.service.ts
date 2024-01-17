import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Router } from '@angular/router';
import { Store, select } from '@ngrx/store';
import { mergeMap } from 'rxjs';
import { AngularFireMessaging } from '@angular/fire/compat/messaging';
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
  RegistrationError,
} from '@capacitor/push-notifications';

import { ApiService } from 'src/app/services/api/api.service';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import { updateCurrentUserAction } from 'src/app/store/actions/user.action';

@Injectable({
  providedIn: 'root',
})
export class FcmService {
  constructor(
    private store: Store,
    private router: Router,
    private api: ApiService,
    private afMessaging: AngularFireMessaging
  ) {}

  async registerPush() {
    // TODO: #226 Web notification can also be implemented here
    if (Capacitor.getPlatform() === 'web') {
      return;
    }

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
      if (Capacitor.getPlatform() === 'ios') {
        this.handleTokenForIOS(token);
      } else if (Capacitor.getPlatform() === 'android') {
        this.handleTokenForAndroid(token);
      }
    });
  }

  // Register push notifications for web
  registerPushForWeb() {
    console.log('Registering push for web...');
    this.afMessaging.requestPermission
      .pipe(mergeMap(() => this.afMessaging.tokenChanges))
      .subscribe({
        next: (token) => {
          if (token) {
            console.log('PWA Token: ', token);
            this.handleTokenForWeb(token);
          }
        },
        error: (error) => {
          console.error(error);
        },
      });
  }

  deregisterPushForWeb() {
    console.log('Deregistering push for web...');
    this.afMessaging.getToken
      .pipe(mergeMap((token) => this.afMessaging.deleteToken(token)))
      .subscribe({
        next: (token) => {
          console.log('Token deleted!');
        },
        error: (error) => {
          console.error(error);
        },
      });
  }

  // Deregister push notifications
  async deregisterPush() {
    if (Capacitor.getPlatform() === 'ios') {
      await this.deleteTokenForIOS();
    }

    if (Capacitor.getPlatform() === 'android') {
      await this.deleteTokenForAndroid();
    }
  }

  listenerPush() {
    // TODO: #226 Web notification can also be implemented here
    if (Capacitor.getPlatform() === 'web') {
      return;
    }

    console.log('Listener FCM started');

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
          // Redirect to chat page
          this.router.navigate(['/', 'home', 'chat', data.roomId]);
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

  handleTokenForIOS(token: Token) {
    this.api.account.getPrefs().then((prefs) => {
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

        // Add "push" to currentUser.notifications
        this.updateCurrentUser('push');
      }
    });
  }

  handleTokenForAndroid(token: Token) {
    this.api.account.getPrefs().then((prefs) => {
      if (prefs['android'] !== token.value) {
        prefs['android'] = token.value;
        this.api.account
          .updatePrefs(prefs)
          .then((res) => {
            console.log('android token updated', res);
          })
          .catch((err) => {
            console.log('android token update error', err);
          });

        // Add "push" to currentUser.notifications
        this.updateCurrentUser('push');
      }
    });
  }

  handleTokenForWeb(token: string) {
    this.api.account.getPrefs().then((prefs) => {
      if (prefs['pwa'] !== token) {
        prefs['pwa'] = token;
        this.api.account
          .updatePrefs(prefs)
          .then((res) => {
            console.log('pwa token updated', res);
          })
          .catch((err) => {
            console.log('pwa token update error', err);
          });

        // Add "pwa" to currentUser.notifications
        this.updateCurrentUser('pwa');
      }
    });
  }

  // Delete token for IOS
  async deleteTokenForIOS() {
    const prefs = await this.api.account.getPrefs();
    if ('ios' in prefs) {
      delete prefs['ios'];
    }
    await this.api.account.updatePrefs(prefs);
  }

  // Delete token for Android
  async deleteTokenForAndroid() {
    const prefs = await this.api.account.getPrefs();
    if ('android' in prefs) {
      delete prefs['android'];
    }
    await this.api.account.updatePrefs(prefs);
  }

  // Update currentUser
  updateCurrentUser(notificationType: string) {
    this.store
      .pipe(select(currentUserSelector))
      .subscribe((currentUser) => {
        if (currentUser) {
          let notifications = [...(currentUser?.notifications || [])];

          if (!notifications.includes(notificationType)) {
            notifications.push(notificationType);
          }

          console.log('notifications :', notifications);
          // Dispatch updateCurrentUserAction
          const request = {
            userId: currentUser?.$id,
            data: { notifications },
          };

          this.store.dispatch(updateCurrentUserAction({ request }));
        }
      })
      .unsubscribe();
  }
}
