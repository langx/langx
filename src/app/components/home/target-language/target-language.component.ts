import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { select, Store } from '@ngrx/store';

import { User } from 'src/app/models/User';
import { FilterDataInterface } from 'src/app/models/types/filterData.interface';
import { currentUserSelector } from 'src/app/store/selectors/auth.selector';
import {
  getUsersByTargetLanguageAction,
  getUsersByTargetLanguageWithOffsetAction,
} from 'src/app/store/actions/users.action';
import {
  isLoadingByTargetLanguageSelector,
  totalByTargetLanguageSelector,
  usersByTargetLanguageSelector,
} from 'src/app/store/selectors/user.selector';

@Component({
  selector: 'app-target-language',
  templateUrl: './target-language.component.html',
  styleUrls: ['./target-language.component.scss'],
})
export class TargetLanguageComponent implements OnInit {
  filterData: FilterDataInterface;

  isLoading$: Observable<boolean>;
  currentUser$: Observable<User>;
  usersByTargetLanguage$: Observable<User[] | null> = null;
  totalByTargetLanguage$: Observable<number | null> = null;

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
      select(isLoadingByTargetLanguageSelector)
    );
    this.usersByTargetLanguage$ = this.store.pipe(
      select(usersByTargetLanguageSelector)
    );
    this.totalByTargetLanguage$ = this.store.pipe(
      select(totalByTargetLanguageSelector)
    );
  }

  //
  // Get Users
  //

  listUsers() {
    const filterData = this.filterData;
    this.store.dispatch(
      getUsersByTargetLanguageAction({ request: { filterData } })
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
    this.usersByTargetLanguage$
      .subscribe((users) => {
        offset = users.length;
        this.totalByTargetLanguage$
          .subscribe((total) => {
            if (offset < total) {
              const filterData = this.filterData;
              this.store.dispatch(
                getUsersByTargetLanguageWithOffsetAction({
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
