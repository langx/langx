import { Component, OnInit } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { Store, select } from '@ngrx/store';
import { Models } from 'appwrite';
import { ToastController } from '@ionic/angular';

import { lastSeen } from 'src/app/extras/utils';
import { Account } from 'src/app/models/Account';
import { User } from 'src/app/models/User';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';
import {
  listIdentitiesAction,
  listSessionsAction,
  verifyEmailAction,
} from 'src/app/store/actions/auth.action';
import {
  accountSelector,
  currentUserSelector,
  identitiesSelector,
  sessionsSelector,
  isLoadingSelector,
  accountDetailError,
} from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-account',
  templateUrl: './account.page.html',
  styleUrls: ['./account.page.scss'],
})
export class AccountPage implements OnInit {
  subscription: Subscription;

  account$: Observable<Account | null> = null;
  currentUser$: Observable<User> = null;
  identities$: Observable<Models.Identity[]> = null;
  sessions$: Observable<Models.Session[]> = null;
  isLoading$: Observable<boolean> = null;

  constructor(private store: Store, private toastController: ToastController) {}

  ngOnInit() {
    this.initValues();
  }

  ionViewWillEnter() {
    this.subscription = new Subscription();

    // Present Toast if error
    this.subscription.add(
      this.store
        .pipe(select(accountDetailError))
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
    // Dispatch the action to list identities
    this.store.dispatch(listIdentitiesAction());
    this.store.dispatch(listSessionsAction());

    // Get Selectors
    this.account$ = this.store.pipe(select(accountSelector));
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
    this.identities$ = this.store.pipe(select(identitiesSelector));
    this.sessions$ = this.store.pipe(select(sessionsSelector));
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
  }

  verifyEmail() {
    this.store.dispatch(verifyEmailAction());
  }

  // TODO: implement these methods
  disableAccount() {
    console.warn('disableAccount clicked');
    // TODO: implement this method
    // First show a modal to confirm the action
    // Then call the service to disable the account
  }

  //
  // Utils
  //

  lastSeen(d: any) {
    if (!d) return null;
    return lastSeen(d);
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
