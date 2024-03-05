import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { exactDateAndTime, getFlagEmoji, lastSeen, onlineStatus } from 'src/app/extras/utils';
import { Streak } from 'src/app/models/Streaks';
import { User } from 'src/app/models/User';

@Component({
  selector: 'app-streak-list',
  templateUrl: './streak-list.component.html',
  styleUrls: ['./streak-list.component.scss'],
})
export class StreakListComponent implements OnInit {
  @Input() item: Streak;
  @Input() order: number;

  user: User;

  constructor(private route: Router) {}

  ngOnInit() {
    this.user = this.item.userId;
  }

  goProfile() {
    this.route.navigateByUrl('/home/user/' + this.user.$id);
  }

  //
  // Utils
  //

  exactDateAndTime(d: any) {
    if (!d) return null;
    return exactDateAndTime(d);
  }

  lastSeen(d: any) {
    if (!d) return null;
    return lastSeen(d);
  }

  onlineStatus(d: any) {
    if (!d) return null;
    return onlineStatus(d);
  }

  getFlagEmoji(item: User) {
    return getFlagEmoji(item);
  }
}