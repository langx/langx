import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { InfinitePage } from './infinite.page';

const routes: Routes = [
  {
    path: '',
    component: InfinitePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class InfinitePageRoutingModule {}
