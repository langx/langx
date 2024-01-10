import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-visitors',
  templateUrl: './visitors.page.html',
  styleUrls: ['./visitors.page.scss'],
})
export class VisitorsPage implements OnInit {
  constructor() {}

  ngOnInit() {}

  //
  // Pull to refresh
  //

  handleRefresh(event) {
    // this.listUsers();
    if (event) event.target.complete();
  }
}
