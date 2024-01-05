import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Capacitor } from '@capacitor/core';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { FcmService } from 'src/app/services/fcm/fcm.service';
import { Account } from 'src/app/models/Account';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
})
export class NotificationsPage implements OnInit {
  form: FormGroup;

  constructor(private store: Store, private fcmService: FcmService) {}

  ngOnInit() {
    this.initForm();
  }

  ionViewWillEnter() {
    this.initValues();
  }

  initForm() {
    this.form = new FormGroup({
      pushNotifications: new FormControl(false),
      emailNotifications: new FormControl(false),
    });
  }

  initValues() {
    // Get Account Preferences
    this.store
      .pipe(select(currentUserSelector))
      .subscribe((currentUser) => {
        console.log(currentUser);
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

    // const account: Account = {
    //   notifications,
    // };

    // await this.fcmService.updateNotifications(account);
  }
}
