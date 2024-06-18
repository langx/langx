import { Component, OnInit } from '@angular/core';
import { Browser } from '@capacitor/browser';
import { Observable, Subscription } from 'rxjs';
import { ToastController } from '@ionic/angular';
import { Store } from '@ngrx/store';

import { environment } from 'src/environments/environment';
import { Wallet } from 'src/app/models/Wallet';

@Component({
  selector: 'app-token-leaderboard',
  templateUrl: './token-leaderboard.page.html',
  styleUrls: ['./token-leaderboard.page.scss'],
})
export class TokenLeaderboardPage implements OnInit {
  infoURL =
    environment.ext.token.LITEPAPER + '/litepaper/token/distibution#formula';
  twitter = environment.ext.token.TWITTER;

  subscription: Subscription;

  isLoading$: Observable<boolean> = null;
  wallets$: Observable<Wallet[] | null> = null;
  total$: Observable<number | null> = null;

  constructor(private store: Store, private toastController: ToastController) {}

  ngOnInit() {
    this.initValues();
    // Get all Streaks
    this.listWallets();
  }

  ionViewWillEnter() {
    this.subscription = new Subscription();

    // User Errors
    // this.subscription.add(
    //   this.store
    //     .pipe(select(errorSelector))
    //     .subscribe((error: ErrorInterface) => {
    //       if (error) {
    //         this.presentToast(error.message, 'danger');
    //         this.store.dispatch(clearErrorsAction());
    //       }
    //     })
    // );
  }

  ionViewWillLeave() {
    // Unsubscribe from all subscriptions
    this.subscription.unsubscribe();
  }

  initValues() {
    // this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    // this.streaks$ = this.store.pipe(select(streaksSelector));
    // this.total$ = this.store.pipe(select(totalSelector));
  }

  listWallets() {
    // Dispatch action to get all visits
    // this.store.dispatch(getStreaksAction());
  }

  //
  // Pull to refresh
  //

  handleRefresh(event) {
    this.listWallets();
    if (event) event.target.complete();
  }

  //
  // Utils
  //

  async openPage(pageURL: any) {
    // console.log(pageURL);
    await Browser.open({ url: pageURL });
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
