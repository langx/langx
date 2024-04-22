import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Streak } from 'src/app/models/Streaks';

@Component({
  selector: 'app-streak-card',
  templateUrl: './streak-card.component.html',
  styleUrls: ['./streak-card.component.scss'],
})
export class StreakCardComponent implements OnInit {
  @Input() streak: Streak;

  constructor(private router: Router) {}

  ngOnInit() {}

  openLeaderboard() {
    this.router.navigate(['/', 'home', 'leaderboard']);
  }
}
