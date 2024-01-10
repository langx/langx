import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

import { lastSeen } from 'src/app/extras/utils';
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
  @Output() onClick: EventEmitter<any> = new EventEmitter();

  user: User;
  constructor(private route: Router) {}

  ngOnInit() {
    this.user = this.item.from;
    console.log('this.user', this.user.$id);
  }

  redirect() {
    this.onClick.emit(this.item);
  }

  goProfile() {
    // this.route.navigateByUrl('/home/user/' + this.item.$id);
  }

  //
  // Utils
  //

  messageTime(d: any) {
    if (!d) return null;
    let time = lastSeen(d);
    if (time === 'online') time = 'now';
    return time;
  }

  lastSeen(d: any) {
    if (!d) return null;
    return lastSeen(d);
  }
}
