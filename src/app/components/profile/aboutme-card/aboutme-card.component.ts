import { Component, Input, OnInit } from '@angular/core';

import { User } from 'src/app/models/User';

@Component({
  selector: 'app-aboutme-card',
  templateUrl: './aboutme-card.component.html',
  styleUrls: ['./aboutme-card.component.scss'],
})
export class AboutmeCardComponent implements OnInit {
  @Input() currentUser: User;

  constructor() {}

  ngOnInit() {}
}
