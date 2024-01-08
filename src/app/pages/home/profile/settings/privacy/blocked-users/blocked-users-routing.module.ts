import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { BlockedUsersPage } from './blocked-users.page';

const routes: Routes = [
  {
    path: '',
    component: BlockedUsersPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BlockedUsersPageRoutingModule {}
