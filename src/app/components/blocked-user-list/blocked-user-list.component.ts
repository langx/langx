import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';

import { lastSeen } from 'src/app/extras/utils';
import { User } from 'src/app/models/User';

@Component({
  selector: 'app-blocked-user-list',
  templateUrl: './blocked-user-list.component.html',
  styleUrls: ['./blocked-user-list.component.scss'],
})
export class BlockedUserListComponent implements OnInit {
  @Input() item: User;
  @Output() onClick: EventEmitter<any> = new EventEmitter();

  constructor(private route: Router) {}

  ngOnInit() {}

  unBlock() {
    this.onClick.emit(this.item);
  }

  goProfile() {
    this.route.navigateByUrl('/home/user/' + this.item.$id);
  }

  getStudyLanguages() {
    let studyLanguages = this.item?.languages
      .filter((language) => !language?.motherLanguage)
      .map((language) => language?.name);
    return studyLanguages.join(', ');
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
