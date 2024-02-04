import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';

import { onlineStatus } from 'src/app/extras/utils';
import { User } from 'src/app/models/User';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.scss'],
})
export class UserListComponent implements OnInit {
  @Input() item: User;
  @Output() onClick: EventEmitter<any> = new EventEmitter();

  constructor() {}

  ngOnInit() {}

  redirect() {
    this.onClick.emit(this.item);
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

  getFlagEmoji(item: User) {
    if (!item) return null;
    const codePoints = item['countryCode']
      .toUpperCase()
      .split('')
      .map((char) => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
  }

  onlineStatus(d: any) {
    if (!d) return null;
    return onlineStatus(d);
  }
}
