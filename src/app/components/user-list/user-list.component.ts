import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.scss'],
})
export class UserListComponent implements OnInit {
  @Input() item: any;
  @Output() onClick: EventEmitter<any> = new EventEmitter();

  constructor(private route: Router) {}

  ngOnInit() {}

  redirect() {
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
}
