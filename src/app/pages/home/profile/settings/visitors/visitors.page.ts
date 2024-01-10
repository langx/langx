import { Component, OnInit } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { User } from 'src/app/models/User';
import { UserService } from 'src/app/services/user/user.service';
import { getVisitsAction } from 'src/app/store/actions/visits.action';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';

@Component({
  selector: 'app-visitors',
  templateUrl: './visitors.page.html',
  styleUrls: ['./visitors.page.scss'],
})
export class VisitorsPage implements OnInit {
  currentUser$: Observable<User | null> = null;

  constructor(private store: Store, private userService: UserService) {}

  ngOnInit() {
    this.initValues();
    // Get all chat Rooms
    this.listVisits();
  }

  initValues() {
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
  }

  listVisits() {
    // Dispatch action to get all visits
    this.store.dispatch(getVisitsAction());
  }

  //
  // Pull to refresh
  //

  handleRefresh(event) {
    if (event) event.target.complete();
  }
}
