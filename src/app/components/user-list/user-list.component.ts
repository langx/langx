import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Observable } from 'rxjs';

import { getFlagEmoji, onlineStatus } from 'src/app/extras/utils';
import { User } from 'src/app/models/User';

// Services Imports
import { UserService } from 'src/app/services/user/user.service';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.scss'],
})
export class UserListComponent implements OnInit {
  @Input() item: User;
  @Output() onClick: EventEmitter<any> = new EventEmitter();

  profilePic$: Observable<URL> = null;

  constructor(private userService: UserService) {}

  ngOnInit() {
    this.profilePic$ = this.userService.getUserFilePreview(
      this.item?.profilePic
    );
  }

  redirect() {
    this.onClick.emit(this.item);
  }

  getStudyLanguages() {
    let studyLanguages = this.item?.languages
      .filter((language) => !language?.motherLanguage)
      .map((language) => language?.name);
    return studyLanguages.join(', ');
  }

  getMotherLanguages() {
    let motherLanguages = this.item?.languages
      .filter((language) => language?.motherLanguage)
      .map((language) => language?.name);
    console.log(motherLanguages);
    return motherLanguages.join(', ');
  }

  //
  // Utils
  //

  getFlagEmoji(item: User) {
    return getFlagEmoji(item);
  }

  onlineStatus(d: any) {
    if (!d) return null;
    return onlineStatus(d);
  }
}
