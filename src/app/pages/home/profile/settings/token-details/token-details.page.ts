import { Component, OnInit } from '@angular/core';
import { Browser } from '@capacitor/browser';

import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-token-details',
  templateUrl: './token-details.page.html',
  styleUrls: ['./token-details.page.scss'],
})
export class TokenDetailsPage implements OnInit {
  infoURL =
    environment.ext.token.LITEPAPER + '/litepaper/token/distibution#formula';
  twitter = environment.ext.token.TWITTER;

  constructor() {}

  ngOnInit() {}

  async openPage(pageURL: any) {
    // console.log(pageURL);
    await Browser.open({ url: pageURL });
  }

  //
  // Pull to refresh
  //

  handleRefresh(event) {
    // this.listStreaks();
    console.log('refresh token details');
    if (event) event.target.complete();
  }
}
