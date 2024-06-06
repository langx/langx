import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Browser } from '@capacitor/browser';

import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-token-distribution',
  templateUrl: './token-distribution.component.html',
  styleUrls: ['./token-distribution.component.scss'],
})
export class TokenDistributionComponent implements OnInit {
  balance: number = 10;

  infoURL = environment.ext.token.LITEPAPER + '/litepaper/token/distibution';

  constructor(private router: Router) {}

  ngOnInit() {}

  openLeaderboard() {
    this.router.navigate(['/', 'home', 'token-details']);
  }

  async openPage(pageURL: any) {
    console.log(pageURL);
    await Browser.open({ url: pageURL });
  }
}
