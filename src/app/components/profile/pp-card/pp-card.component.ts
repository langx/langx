import { Component, Input, OnInit } from '@angular/core';

import { User } from 'src/app/models/User';

@Component({
  selector: 'app-pp-card',
  templateUrl: './pp-card.component.html',
  styleUrls: ['./pp-card.component.scss'],
})
export class PpCardComponent implements OnInit {
  @Input() currentUser: User;

  constructor() {}

  ngOnInit() {
    console.log(this.currentUser);
  }
}
