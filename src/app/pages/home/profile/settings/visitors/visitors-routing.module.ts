import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { VisitorsPage } from './visitors.page';

const routes: Routes = [
  {
    path: '',
    component: VisitorsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VisitorsPageRoutingModule {}
