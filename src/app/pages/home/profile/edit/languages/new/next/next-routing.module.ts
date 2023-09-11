import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { NextPage } from './next.page';

const routes: Routes = [
  {
    path: '',
    component: NextPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class NextPageRoutingModule {}
