import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Capacitor } from '@capacitor/core';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';

import { FcmService } from 'src/app/services/fcm/fcm.service';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import { updateCurrentUserAction } from 'src/app/store/actions/user.action';
import {
  currentUserSelector,
  editProfileErrorSelector,
} from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
})
export class NotificationsPage implements OnInit {
  form: FormGroup;

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

    // Present Toast if success and set form values
    this.subscription.add(
      this.currentUser$.subscribe((currentUser) => {
        if (currentUser?.notifications !== this.currentUser?.notifications) {
          this.presentToast('Notification settings updated!', 'success');
        }
        this.currentUser = currentUser;
        if (currentUser) {
          const notifications = currentUser?.notifications;

          this.form
            .get('pushNotifications')
            .setValue(notifications.includes('push'));
          this.form
            .get('emailNotifications')
            .setValue(notifications.includes('email'));
        }
      })
    );

    // Present Toast if verifyEmailSuccess
    this.subscription.add(
      this.store
        .pipe(select(editProfileErrorSelector))
        .subscribe((error: ErrorInterface) => {
          if (error) {
            this.presentToast(error.message, 'danger');
          }
        })
    );
  }

  ionViewWillLeave() {
    // Unsubscribe from all subscriptions
    this.subscription.unsubscribe();
  }

  initForm() {
    this.form = new FormGroup({
      pushNotifications: new FormControl(false),
      emailNotifications: new FormControl(false),
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

  async togglePushNotifications() {
    const pushNotifications = this.form.get('pushNotifications').value;
    const emailNotifications = this.form.get('emailNotifications').value;

    console.log(this.form.value);

    const notifications = [];

    if (pushNotifications) {
      notifications.push('push');
    }

    if (emailNotifications) {
      notifications.push('email');
    }

    // Dispatch updateCurrentUserAction
    const request = {
      userId: this.currentUser?.$id,
      data: { notifications },
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
