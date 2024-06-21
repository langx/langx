import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';

import { UserService } from 'src/app/services/user/user.service';
import { getFlagEmoji2, lastSeen } from 'src/app/extras/utils';
import { User } from 'src/app/models/User';

@Component({
  selector: 'app-blocked-user-list',
  templateUrl: './blocked-user-list.component.html',
  styleUrls: ['./blocked-user-list.component.scss'],
})
export class BlockedUserListComponent implements OnInit {
  @Input() item: User;
  @Output() onClick: EventEmitter<any> = new EventEmitter();

  profilePic$: Observable<URL> = null;

  constructor(private route: Router, private userService: UserService) {}

  ngOnInit() {
    this.profilePic$ = this.userService.getUserFilePreview(
      this.item?.profilePic
    );
  }

  unBlock() {
    this.onClick.emit(this.item);
  }

  goProfile() {
    this.route.navigateByUrl('/home/user/' + this.item.$id);
  }

  getStudyLanguages() {
    let studyLanguages = this.item?.languages
      .filter((language) => !language?.motherLanguage)
      .map((language) => language?.code);
    const flags = studyLanguages.map((lang) => getFlagEmoji2(lang));
    return flags.join(' ');
  }

  getMotherLanguages() {
    let motherLanguages = this.item?.languages
      .filter((language) => language?.motherLanguage)
      .map((language) => language?.code);
    const flags = motherLanguages.map((lang) => getFlagEmoji2(lang));
    return flags.join(' ');
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
