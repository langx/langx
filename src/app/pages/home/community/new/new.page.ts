import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { User } from 'src/app/models/User';
import { FilterDataInterface } from 'src/app/models/types/filterData.interface';
import { FilterService } from 'src/app/services/filter/filter.service';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import {
  getUsersByCreatedAtAction,
  getUsersByCreatedAtWithOffsetAction,
} from 'src/app/store/actions/users.action';
import {
  isLoadingSelector,
  totalByCreatedAtSelector,
  usersByCreatedAtSelector,
} from 'src/app/store/selectors/user.selector';

@Component({
  selector: 'app-new',
  templateUrl: './new.page.html',
  styleUrls: ['./new.page.scss'],
})
export class NewPage implements OnInit {
  filter$: any;
  filterData: FilterDataInterface;

  isLoading$: Observable<boolean>;
  currentUser$: Observable<User>;
  usersByCreatedAt$: Observable<User[] | null> = null;
  totalByCreatedAt$: Observable<number | null> = null;

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
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    this.currentUser$ = this.store.pipe(select(currentUserSelector));
    this.usersByCreatedAt$ = this.store.pipe(select(usersByCreatedAtSelector));
    this.totalByCreatedAt$ = this.store.pipe(select(totalByCreatedAtSelector));
  }

  //
  // Get Users
  //

  listUsers() {
    const filterData = this.filterData;
    this.store.dispatch(getUsersByCreatedAtAction({ request: { filterData } }));
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
    this.usersByCreatedAt$
      .subscribe((users) => {
        offset = users.length;
        this.totalByCreatedAt$
          .subscribe((total) => {
            if (offset < total) {
              const filterData = this.filterData;
              this.store.dispatch(
                getUsersByCreatedAtWithOffsetAction({
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
