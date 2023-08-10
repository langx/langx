import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CommunityPage } from './community.page';

const routes: Routes = [
  {
    path: '',
    component: CommunityPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CommunityPageRoutingModule {}
