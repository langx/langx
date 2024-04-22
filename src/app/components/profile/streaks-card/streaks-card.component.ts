import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Streak } from 'src/app/models/Streaks';

@Component({
  selector: 'app-streaks-card',
  templateUrl: './streaks-card.component.html',
  styleUrls: ['./streaks-card.component.scss'],
})
export class StreaksCardComponent implements OnInit {
  @Input() streaks: Streak;

  constructor(private router: Router) {}

  ngOnInit() {
    console.log(this.streaks);
  }

  openLeaderboard() {
    this.router.navigate(['/', 'home', 'leaderboard']);
  }
}
