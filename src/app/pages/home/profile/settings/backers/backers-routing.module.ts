import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { BackersPage } from './backers.page';

const routes: Routes = [
  {
    path: '',
    component: BackersPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BackersPageRoutingModule {}
