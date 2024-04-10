import { Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

import { UserService } from 'src/app/services/user/user.service';
import { Streak } from 'src/app/models/Streaks';
import { User } from 'src/app/models/User';
import { getFlagEmoji, lastSeen, onlineStatus } from 'src/app/extras/utils';

@Component({
  selector: 'app-streak-list',
  templateUrl: './streak-list.component.html',
  styleUrls: ['./streak-list.component.scss'],
})
export class StreakListComponent implements OnInit {
  @Input() item: Streak;
  @Input() order: number;

  user: User;
  profilePic$: Observable<URL> = null;

  constructor(private route: Router, private userService: UserService) {}

  ngOnInit() {
    this.user = this.item.userId;
    this.profilePic$ = this.userService.getUserFilePreview(
      this.user?.profilePic
    );
  }

  goProfile() {
    this.route.navigateByUrl('/home/user/' + this.user.$id);
  }

  //
  // Utils
  //

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
