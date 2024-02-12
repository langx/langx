import { Component, OnInit } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

import { User } from 'src/app/models/User';

@Component({
  selector: 'app-contributors',
  templateUrl: './contributors.page.html',
  styleUrls: ['./contributors.page.scss'],
})
export class ContributorsPage implements OnInit {
  subscription: Subscription;

  isLoading$: Observable<boolean> = null;
  users$: Observable<User[] | null> = null;
  total$: Observable<number | null> = null;

  model = {
    icon: 'people-outline',
    title: 'No Contributors Yet',
    color: 'warning',
  };

  constructor() {}

  ngOnInit() {}
}
