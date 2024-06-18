import { Component, OnInit } from '@angular/core';
import { Browser } from '@capacitor/browser';

import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-token-leaderboard',
  templateUrl: './token-leaderboard.page.html',
  styleUrls: ['./token-leaderboard.page.scss'],
})
export class TokenLeaderboardPage implements OnInit {
  infoURL =
    environment.ext.token.LITEPAPER + '/litepaper/token/distibution#formula';
  twitter = environment.ext.token.TWITTER;

  constructor() {}

  ngOnInit() {}

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
}
