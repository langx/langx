import { Component, OnInit } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { User } from 'src/app/models/User';
import { Visit } from 'src/app/models/Visit';
import { UserService } from 'src/app/services/user/user.service';
import { getVisitsAction } from 'src/app/store/actions/visits.action';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import {
  isLoadingSelector,
  totalSelector,
  visitsSelector,
} from 'src/app/store/selectors/visits.selector';

@Component({
  selector: 'app-visitors',
  templateUrl: './visitors.page.html',
  styleUrls: ['./visitors.page.scss'],
})
export class VisitorsPage implements OnInit {
  currentUser$: Observable<User | null> = null;
  isLoading$: Observable<boolean> = null;
  visits$: Observable<Visit[] | null> = null;
  total$: Observable<number | null> = null;

  constructor(private store: Store, private userService: UserService) {}

  ngOnInit() {
    this.initValues();
    // Get all chat Rooms
    this.listVisits();
  }

  initValues() {
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
    this.visits$ = this.store.pipe(select(visitsSelector));
    this.total$ = this.store.pipe(select(totalSelector));
  }

  listVisits() {
    // Dispatch action to get all visits
    this.store.dispatch(getVisitsAction());
  }

  getRoom(user: any) {
    console.log('getRoom', user);
  }

  //
  // Pull to refresh
  //

  handleRefresh(event) {
    if (event) event.target.complete();
  }
}
