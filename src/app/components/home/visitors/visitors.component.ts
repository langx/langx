import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import { Visit } from 'src/app/models/Visit';

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
  isLoadingVisits$: Observable<boolean>;
  visits$: Observable<Visit[] | null> = null;
  totalVisits$: Observable<number | null> = null;
  model = {
    icon: 'people-outline',
    title: 'No Profile Visitors Yet',
    color: 'warning',
  };

  constructor(private store: Store, private router: Router) {}

  ngOnInit() {
    // Visits
    this.isLoadingVisits$ = this.store.pipe(select(isLoadingSelector));
    this.visits$ = this.store.pipe(select(visitsSelector));
    this.totalVisits$ = this.store.pipe(select(totalSelector));
  }

  getVisitsPage() {
    this.router.navigateByUrl('/home/visitors');
  }
}
