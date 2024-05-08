import { Component, OnInit } from '@angular/core';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { Visit } from 'src/app/models/Visit';
import { getVisitsWithOffsetAction } from 'src/app/store/actions/visits.action';

import {
  isLoadingSelector,
  totalSelector,
  visitsSelector,
} from 'src/app/store/selectors/visits.selector';

@Component({
  selector: 'app-visitors',
  templateUrl: './visitors.component.html',
  styleUrls: ['./visitors.component.scss'],
})
export class VisitorsComponent implements OnInit {
  isLoading$: Observable<boolean> = null;
  visits$: Observable<Visit[] | null> = null;
  total$: Observable<number | null> = null;

  isAllDone: boolean = false;

  noVisitors = {
    icon: 'people-outline',
    title: 'No Visitors Yet',
    color: 'warning',
  };

  allDone = {
    icon: 'people-outline',
    title: 'All visitors loaded',
    color: 'primary',
  };

  constructor(private store: Store) {}

  ngOnInit() {
    this.isLoading$ = this.store.pipe(select(isLoadingSelector));
    this.visits$ = this.store.pipe(select(visitsSelector));
    this.total$ = this.store.pipe(select(totalSelector));
  }

  //
  // Infinite Scroll
  //

  loadMore(event) {
    // Offset is the number of users already loaded
    let offset: number = 0;
    this.visits$
      .subscribe((visits) => {
        offset = visits.length;
        this.total$
          .subscribe((total) => {
            if (offset < total) {
              // console.log('offset', offset);
              // console.log('total', total);
              this.store.dispatch(
                getVisitsWithOffsetAction({
                  request: {
                    offset,
                  },
                })
              );
            } else {
              // console.log('All visits loaded');
              this.isAllDone = true;
            }
          })
          .unsubscribe();
      })
      .unsubscribe();

    event.target.complete();
  }
}
