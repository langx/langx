import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';

import { FcmService } from 'src/app/services/fcm/fcm.service';
import { User } from 'src/app/models/User';
import { updateCurrentUserAction } from 'src/app/store/actions/user.action';
import {
  currentUserSelector,
  isLoadingSelector,
} from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
})
export class NotificationsPage implements OnInit {
  notificationsArrayForm: FormGroup;
  notificationsForm: FormGroup;

  subscription: Subscription;
  currentUser$: Observable<User>;
  currentUser: User;

  constructor(
    private store: Store,
    private fcmService: FcmService,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.initForm();

    // Trigger FCM registration
    this.fcmService.registerPush();
  }

  ionViewWillEnter() {
    this.initValues();
    this.subscription = new Subscription();

    this.subscription.add(
      this.store.pipe(select(isLoadingSelector)).subscribe((isLoading) => {
        if (isLoading) {
          this.notificationsArrayForm.disable();
          this.notificationsForm.disable();
        } else {
          this.notificationsArrayForm.enable();
          this.notificationsForm.enable();
        }
      })
    );

    // Present Toast if success and set form values
    this.subscription.add(
      this.currentUser$.subscribe((currentUser) => {
        // TODO: Fix this bug then present toast, it recures when user updates profile
        // if (currentUser?.notifications !== this.currentUser?.notifications) {
        //   this.presentToast('Notification settings updated!', 'success');
        // }
        if (currentUser) {
          this.currentUser = currentUser;

          // Set Notification Array
          const notificationsArray = currentUser?.notificationsArray;
          this.notificationsArrayForm
            .get('message')
            .setValue(notificationsArray.includes('message'));
          this.notificationsArrayForm
            .get('visit')
            .setValue(notificationsArray.includes('visit'));
          this.notificationsArrayForm
            .get('update')
            .setValue(notificationsArray.includes('update'));
          this.notificationsArrayForm
            .get('promotion')
            .setValue(notificationsArray.includes('promotion'));

          // Set Channels
          const notifications = currentUser?.notifications;
          this.notificationsForm
            .get('pushNotifications')
            .setValue(notifications.includes('push'));
          this.notificationsForm
            .get('emailNotifications')
            .setValue(notifications.includes('email'));
          this.notificationsForm
            .get('pwaNotifications')
            .setValue(notifications.includes('pwa'));
        }
      })
    );
  }

  ionViewWillLeave() {
    // Unsubscribe from all subscriptions
    this.subscription.unsubscribe();
  }

  initForm() {
    this.notificationsArrayForm = new FormGroup({
      message: new FormControl(false),
      visit: new FormControl(false),
      update: new FormControl(false),
      promotion: new FormControl(false),
    });

    this.notificationsForm = new FormGroup({
      pushNotifications: new FormControl(false),
      emailNotifications: new FormControl(false),
      pwaNotifications: new FormControl(false),
    });
  }

  initValues() {
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
    this.currentUser$
      .subscribe((currentUser) => {
        // Set initial values
        this.currentUser = currentUser;
      })
      .unsubscribe();
  }

  async toggleNotificationsArray() {}

  async toggleChannels() {
    const pushNotifications =
      this.notificationsForm.get('pushNotifications').value;
    const emailNotifications =
      this.notificationsForm.get('emailNotifications').value;
    const pwaNotifications =
      this.notificationsForm.get('pwaNotifications').value;

    // console.log(this.notificationsForm.value);

    const notifications = [];

    if (pushNotifications) {
      notifications.push('push');
    }

    if (emailNotifications) {
      notifications.push('email');
    }

    if (pwaNotifications) {
      notifications.push('pwa');
    }

    // Dispatch updateCurrentUserAction
    this.updateCurrentUser({ notifications });
  }

  //
  // Dispatch Actions
  //

  updateCurrentUser(data: any) {
    const request = {
      userId: this.currentUser?.$id,
      data: data,
    };

    this.store.dispatch(updateCurrentUserAction({ request }));
  }

  //
  // Present Toast
  //

  async presentToast(msg: string, color?: string) {
    const toast = await this.toastController.create({
      message: msg,
      color: color || 'primary',
      duration: 1500,
      position: 'bottom',
    });

    await toast.present();
  }
}
