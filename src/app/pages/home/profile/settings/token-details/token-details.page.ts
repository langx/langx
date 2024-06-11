import { Component, OnInit } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { Browser } from '@capacitor/browser';
import { ToastController } from '@ionic/angular';
import { Observable, Subscription, take } from 'rxjs';

import { environment } from 'src/environments/environment';
import { User } from 'src/app/models/User';
import { Wallet } from 'src/app/models/Wallet';
import { Checkout } from 'src/app/models/Checkout';
import { ErrorInterface } from 'src/app/models/types/errors/error.interface';

import { walletSelector } from 'src/app/store/selectors/wallet.selector';
import {
  errorSelector,
  isLoadingSelector,
  totalSelector,
  checkoutsSelector,
} from 'src/app/store/selectors/checkouts.selector';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import {
  getCheckoutsAction,
  getCheckoutsWithOffsetAction,
  clearErrorsAction,
} from 'src/app/store/actions/checkouts.action';

@Component({
  selector: 'app-token-details',
  templateUrl: './token-details.page.html',
  styleUrls: ['./token-details.page.scss'],
})
export class TokenDetailsPage implements OnInit {
  infoURL =
    environment.ext.token.LITEPAPER + '/litepaper/token/distibution#formula';
  twitter = environment.ext.token.TWITTER;

  subscription: Subscription;

  currentUser$: Observable<User | null> = null;
  isLoading$: Observable<boolean> = null;
  checkouts$: Observable<Checkout[] | null> = null;
  total$: Observable<number | null> = null;
  wallet$: Observable<Wallet> = null;

  constructor(private store: Store, private toastController: ToastController) {}

  ngOnInit() {
    this.initValues();
    // Get all Streaks
    this.listCheckouts();
  }

  ionViewWillEnter() {
    this.subscription = new Subscription();

    // User Errors
    this.subscription.add(
      this.store
        .pipe(select(errorSelector))
        .subscribe((error: ErrorInterface) => {
          if (error) {
            this.presentToast(error.message, 'danger');
            this.store.dispatch(clearErrorsAction());
          }
        })
    );
  }

  ionViewWillLeave() {
    // Unsubscribe from all subscriptions
    this.subscription.unsubscribe();
  }

  initValues() {
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    this.checkouts$ = this.store.pipe(select(checkoutsSelector));
    this.total$ = this.store.pipe(select(totalSelector));
    this.wallet$ = this.store.pipe(select(walletSelector));
  }

  listCheckouts() {
    // Dispatch action to get all visits
    this.store.dispatch(getCheckoutsAction());
  }

  async openPage(pageURL: any) {
    // console.log(pageURL);
    await Browser.open({ url: pageURL });
  }

  //
  // Infinite Scroll
  //

  loadMore(event) {
    this.checkouts$.pipe(take(1)).subscribe((checkouts) => {
      const offset = checkouts.length;
      this.total$.pipe(take(1)).subscribe((total) => {
        if (offset < total) {
          this.store.dispatch(
            getCheckoutsWithOffsetAction({
              request: {
                offset,
              },
            })
          );
        }
      });
    });
    event.target.complete();
  }

  //
  // Pull to refresh
  //

  handleRefresh(event) {
    this.listCheckouts();
    console.log('refresh token details');
    if (event) event.target.complete();
  }

  //
  // Present Toast
  //

  async presentToast(msg: string, color?: string) {
    const toast = await this.toastController.create({
      message: msg,
      color: color || 'primary',
      duration: 1000,
      position: 'top',
    });

    await toast.present();
  }
}
