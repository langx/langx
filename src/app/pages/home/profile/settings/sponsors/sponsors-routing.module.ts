import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SponsorsPage } from './sponsors.page';

const routes: Routes = [
  {
    path: '',
    component: SponsorsPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SponsorsPageRoutingModule {}
