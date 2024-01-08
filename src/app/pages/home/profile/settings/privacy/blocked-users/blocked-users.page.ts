import { Component, OnInit } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { User } from 'src/app/models/User';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-blocked-users',
  templateUrl: './blocked-users.page.html',
  styleUrls: ['./blocked-users.page.scss'],
})
export class BlockedUsersPage implements OnInit {
  currentUser$: Observable<User | null>;
  constructor(private store: Store) {}

  ngOnInit() {
    this.initValues();
  }

  initValues() {
    // Get blocked users data
    // this.store.dispatch();
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
  }
}
