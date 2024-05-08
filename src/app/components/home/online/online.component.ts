import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { select, Store } from '@ngrx/store';

import { User } from 'src/app/models/User';
import { FilterDataInterface } from 'src/app/models/types/filterData.interface';
import { FilterService } from 'src/app/services/filter/filter.service';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import {
  getUsersByLastSeenAction,
  getUsersByLastSeenWithOffsetAction,
} from 'src/app/store/actions/users.action';
import {
  totalByLastSeenSelector,
  usersByLastSeenSelector,
  isLoadingByLastSeenSelector,
} from 'src/app/store/selectors/user.selector';

@Component({
  selector: 'app-online',
  templateUrl: './online.component.html',
  styleUrls: ['./online.component.scss'],
})
export class OnlineComponent implements OnInit {
  filter$: any;
  filterData: FilterDataInterface;

  isLoading$: Observable<boolean>;
  currentUser$: Observable<User>;
  usersByLastSeen$: Observable<User[] | null> = null;
  totalByLastSeen$: Observable<number | null> = null;

  noUser = {
    icon: 'people-outline',
    title: 'No Users Yet',
    color: 'warning',
  };

  constructor(
    private store: Store,
    private router: Router,
    private filterService: FilterService
  ) {}

  async ngOnInit() {
    this.initValues();

    // Check Local Storage for filters
    await this.checkFilter();
  }

  initValues(): void {
    // Set values from selectors
    this.currentUser$ = this.store.pipe(select(currentUserSelector));

    this.isLoading$ = this.store.pipe(select(isLoadingByLastSeenSelector));
    this.usersByLastSeen$ = this.store.pipe(select(usersByLastSeenSelector));
    this.totalByLastSeen$ = this.store.pipe(select(totalByLastSeenSelector));
  }

  //
  // Get Users
  //

  listUsers() {
    const filterData = this.filterData;
    this.store.dispatch(getUsersByLastSeenAction({ request: { filterData } }));
  }

  //
  // Check Filter
  //

  async checkFilter() {
    this.filter$ = this.filterService
      .getEvent()
      .subscribe((filterData: FilterDataInterface) => {
        this.filterData = filterData;
        // console.log('Subscribed filter: ', filterData);

        // List Users
        this.listUsers();
      });
  }

  //
  // Routes
  //

  getUserPage(id: string): void {
    this.router.navigate([`/home/user/${id}`]);
  }

  //
  // Infinite Scroll
  //

  loadMore(event) {
    // Offset is the number of users already loaded
    let offset: number = 0;
    this.usersByLastSeen$
      .subscribe((users) => {
        offset = users.length;
        this.totalByLastSeen$
          .subscribe((total) => {
            if (offset < total) {
              const filterData = this.filterData;
              this.store.dispatch(
                getUsersByLastSeenWithOffsetAction({
                  request: {
                    filterData,
                    offset,
                  },
                })
              );
            } else {
              console.log('All users loaded');
            }
          })
          .unsubscribe();
      })
      .unsubscribe();

    // this.getUsers(this.filterData);
    event.target.complete();
  }
}
