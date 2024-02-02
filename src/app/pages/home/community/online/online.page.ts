import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { select, Store } from '@ngrx/store';

import { User } from 'src/app/models/User';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import {
  getUsersByLastSeenAction,
  getUsersByLastSeenWithOffsetAction,
} from 'src/app/store/actions/users.action';
import { FilterDataInterface } from 'src/app/models/types/filterData.interface';
import { FilterService } from 'src/app/services/filter/filter.service';
import { StorageService } from 'src/app/services/storage/storage.service';
import {
  totalByLastSeenSelector,
  usersByLastSeenSelector,
  isLoadingSelector,
} from 'src/app/store/selectors/user.selector';

@Component({
  selector: 'app-online',
  templateUrl: './online.page.html',
  styleUrls: ['./online.page.scss'],
})
export class OnlinePage implements OnInit {
  filter$: any;
  filterData: FilterDataInterface;

  isLoading$: Observable<boolean>;
  currentUser$: Observable<User>;
  usersByLastSeen$: Observable<User[] | null> = null;
  totalByLastSeenSelector$: Observable<number | null> = null;

  constructor(
    private store: Store,
    private router: Router,
    private filterService: FilterService,
    private storageService: StorageService
  ) {}

  async ngOnInit() {
    this.initValues();

    // Check Local Storage for filters
    await this.checkFilter();
  }

  initValues(): void {
    // Set values from selectors
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
    this.usersByLastSeen$ = this.store.pipe(select(usersByLastSeenSelector));
    this.totalByLastSeenSelector$ = this.store.pipe(select(totalByLastSeenSelector));
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
  // Pull to refresh
  //

  handleRefresh(event) {
    this.listUsers();
    if (event) event.target.complete();
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
        this.totalByLastSeenSelector$
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
