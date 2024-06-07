import { Component, Input, OnInit } from '@angular/core';
import { Browser } from '@capacitor/browser';
import { Router } from '@angular/router';

import { environment } from 'src/environments/environment';
import { Streak } from 'src/app/models/Streak';

@Component({
  selector: 'app-streak-card',
  templateUrl: './streak-card.component.html',
  styleUrls: ['./streak-card.component.scss'],
})
export class StreakCardComponent implements OnInit {
  @Input() streak: Streak;

  infoURL = environment.ext.token.LITEPAPER + '/litepaper/library/day-streaks';

  constructor(private router: Router) {}

  ngOnInit() {}

  openLeaderboard() {
    this.router.navigate(['/', 'home', 'leaderboard']);
  }

  async openPage(pageURL: any) {
    // console.log(pageURL);
    await Browser.open({ url: pageURL });
  }
}
