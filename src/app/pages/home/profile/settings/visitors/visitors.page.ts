import { Component, OnInit } from '@angular/core';
import { Store, select } from '@ngrx/store';

@Component({
  selector: 'app-visitors',
  templateUrl: './visitors.page.html',
  styleUrls: ['./visitors.page.scss'],
})
export class VisitorsPage implements OnInit {
  constructor(private store: Store) {}

  ngOnInit() {
    this.initValues();
    // Get all chat Rooms
    this.listVisits();
  }

  initValues() {}

  listVisits() {
    // Dispatch action to get all visits
    // this.store.dispatch(getVisitsAction({ request: {  } }));
  }

  //
  // Pull to refresh
  //

  handleRefresh(event) {
    // this.listUsers();
    if (event) event.target.complete();
  }
}
