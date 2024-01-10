import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';

import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import {
  getBlockedUsersAction,
  unBlockUserAction,
  unBlockUserInitialStateAction,
} from 'src/app/store/actions/user.action';
import {
  blockedUsersDataSelector,
  currentUserSelector,
  isLoadingSelector,
  unBlockUserErrorSelector,
  unBlockUserSuccessSelector,
} from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-blocked-users',
  templateUrl: './blocked-users.page.html',
  styleUrls: ['./blocked-users.page.scss'],
})
export class BlockedUsersPage implements OnInit {
  subscription: Subscription;

  isLoading$: Observable<boolean>;
  currentUser$: Observable<User | null>;
  blockedUsersData$: Observable<User[] | null>;

  model = {
    icon: 'ban-outline',
    title: 'No Blocked Users',
    color: 'warning',
  };

  constructor(private store: Store, private toastController: ToastController) {}

  ngOnInit() {
    this.initValues();
  }

  ionViewWillEnter() {
    this.subscription = new Subscription();

    // UnBlock User Success
    this.subscription.add(
      this.store
        .pipe(select(unBlockUserSuccessSelector))
        .subscribe((success) => {
          if (success) {
            this.presentToast('User unblocked successfully', 'success');
            this.store.dispatch(unBlockUserInitialStateAction());
          }
        })
    );

    // UnBlock User Errors
    this.subscription.add(
      this.store
        .pipe(select(unBlockUserErrorSelector))
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

  initValues() {
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
    this.blockedUsersData$ = this.store.pipe(select(blockedUsersDataSelector));

    // Get blocked users data
    this.currentUser$
      .subscribe((currentUser) => {
        if (currentUser) {
          this.getBlockedUsers(currentUser?.blockedUsers);
        }
      })
      .unsubscribe();
  }

  getBlockedUsers(blockedUsers: string[]) {
    const request = { blockedUsers };
    this.store.dispatch(getBlockedUsersAction({ request }));
  }

  unBlock(userId: string) {
    const request = { userId };
    this.store.dispatch(unBlockUserAction({ request }));
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
