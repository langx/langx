import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ContributorsPage } from './contributors.page';

const routes: Routes = [
  {
    path: '',
    component: ContributorsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ContributorsPageRoutingModule {}
