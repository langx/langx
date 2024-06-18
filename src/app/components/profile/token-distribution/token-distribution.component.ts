import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Browser } from '@capacitor/browser';
import { Store, select } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';

import { environment } from 'src/environments/environment';
import { getWalletAction } from 'src/app/store/actions/wallet.action';
import { walletSelector } from 'src/app/store/selectors/wallet.selector';
import { Wallet } from 'src/app/models/Wallet';

@Component({
  selector: 'app-token-distribution',
  templateUrl: './token-distribution.component.html',
  styleUrls: ['./token-distribution.component.scss'],
})
export class TokenDistributionComponent implements OnInit {
  infoURL = environment.ext.token.LITEPAPER + '/litepaper/token/distibution';

  wallet$: Observable<Wallet>;

  subscription: Subscription;

  constructor(private store: Store, private router: Router) {}

  ngOnInit() {
    this.initValues();
  }

  ionViewWillEnter() {
    this.subscription = new Subscription();

    // Profile Error Handling
    this.subscription
      .add
      // this.store
      //   .pipe(select(ErrorSelector))
      //   .subscribe((error: ErrorInterface) => {
      //     if (error && error.message) {
      //       this.presentToast(error.message, 'danger');
      //       this.store.dispatch(clearErrorsAction());
      //     }
      //   })
      ();
  }

  ionViewWillLeave() {
    // Unsubscribe from all subscriptions
    this.subscription.unsubscribe();
  }

  initValues() {
    this.store.dispatch(getWalletAction());
    this.wallet$ = this.store.pipe(select(walletSelector));
  }

  openTokenDetails() {
    this.router.navigate(['/', 'home', 'token-details']);
  }

  openTokenLeaderboard() {
    this.router.navigate(['/', 'home', 'token-leaderboard']);
  }

  async openPage(pageURL: any) {
    console.log(pageURL);
    await Browser.open({ url: pageURL });
  }
}
