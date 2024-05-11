import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { FundamentalsPage } from './fundamentals.page';

const routes: Routes = [
  {
    path: '',
    component: FundamentalsPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FundamentalsPageRoutingModule {}
