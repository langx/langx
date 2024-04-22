import { Component, Input, OnInit } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';

import { UserService } from 'src/app/services/user/user.service';

@Component({
  selector: 'app-other-photos-card',
  templateUrl: './other-photos-card.component.html',
  styleUrls: ['./other-photos-card.component.scss'],
})
export class OtherPhotosCardComponent implements OnInit {
  @Input() otherPics: string[];

  otherPics$: Observable<URL[]> = of([]);

  constructor(private userService: UserService) {}

  ngOnInit() {
    this.otherPics$ = forkJoin(
      (this.otherPics || []).map((id) => this.userService.getUserFileView(id))
    );
  }
}
