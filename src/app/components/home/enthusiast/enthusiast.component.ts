import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { User } from 'src/app/models/User';
import { FilterDataInterface } from 'src/app/models/types/filterData.interface';
import {
  getUsersByCompletedProfileAction,
  getUsersByCompletedProfileWithOffsetAction,
} from 'src/app/store/actions/users.action';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import {
  isLoadingByCompletedProfileSelector,
  totalByCompletedProfileSelector,
  usersByCompletedProfileSelector,
} from 'src/app/store/selectors/user.selector';

@Component({
  selector: 'app-enthusiast',
  templateUrl: './enthusiast.component.html',
  styleUrls: ['./enthusiast.component.scss'],
})
export class EnthusiastComponent implements OnInit {
  filterData: FilterDataInterface;

  isLoading$: Observable<boolean>;
  currentUser$: Observable<User>;
  usersByCompletedProfile$: Observable<User[] | null> = null;
  totalByCompletedProfile$: Observable<number | null> = null;

  noUser = {
    icon: 'people-outline',
    title: 'No Users Yet',
    color: 'warning',
  };

  constructor(private store: Store, private router: Router) {}

  async ngOnInit() {
    this.initValues();
  }

  initValues(): void {
    // Set values from selectors
    this.currentUser$ = this.store.pipe(select(currentUserSelector));

    this.isLoading$ = this.store.pipe(
      select(isLoadingByCompletedProfileSelector)
    );
    this.usersByCompletedProfile$ = this.store.pipe(
      select(usersByCompletedProfileSelector)
    );
    this.totalByCompletedProfile$ = this.store.pipe(
      select(totalByCompletedProfileSelector)
    );
  }

  //
  // Get Users
  //

  listUsers() {
    const filterData = this.filterData;
    this.store.dispatch(
      getUsersByCompletedProfileAction({ request: { filterData } })
    );
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
    this.usersByCompletedProfile$
      .subscribe((users) => {
        offset = users.length;
        this.totalByCompletedProfile$
          .subscribe((total) => {
            if (offset < total) {
              const filterData = this.filterData;
              this.store.dispatch(
                getUsersByCompletedProfileWithOffsetAction({
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
