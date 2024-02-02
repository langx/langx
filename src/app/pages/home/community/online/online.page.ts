import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { select, Store } from '@ngrx/store';

import { User } from 'src/app/models/User';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import {
  totalSelector,
  usersSelector,
  isLoadingSelector,
} from 'src/app/store/selectors/user.selector';
import { Router } from '@angular/router';

@Component({
  selector: 'app-online',
  templateUrl: './online.page.html',
  styleUrls: ['./online.page.scss'],
})
export class OnlinePage implements OnInit {
  isLoading$: Observable<boolean>;
  currentUser$: Observable<User>;
  users$: Observable<User[] | null> = null;
  total$: Observable<number | null> = null;

  constructor(private store: Store, private router: Router) {}

  ngOnInit() {
    this.initValues();
  }

  initValues(): void {
    // Set values from selectors
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
    this.users$ = this.store.pipe(select(usersSelector));
    this.total$ = this.store.pipe(select(totalSelector));
  }

  //
  // Routes
  //

  getUserPage(id: string): void {
    this.router.navigate([`/home/user/${id}`]);
  }
}
