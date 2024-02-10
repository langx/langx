import { Component, Input, OnInit } from '@angular/core';

import { lastSeen, exactDateAndTime, onlineStatus } from 'src/app/extras/utils';
import { Router } from '@angular/router';
import { Visit } from 'src/app/models/Visit';
import { User } from 'src/app/models/User';

@Component({
  selector: 'app-visit-list',
  templateUrl: './visit-list.component.html',
  styleUrls: ['./visit-list.component.scss'],
})
export class VisitListComponent implements OnInit {
  @Input() item: Visit;

  user: User;

  constructor(private route: Router) {}

  ngOnInit() {
    this.user = this.item.from;
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
}
