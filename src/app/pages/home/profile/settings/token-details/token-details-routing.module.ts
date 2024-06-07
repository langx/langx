import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TokenDetailsPage } from './token-details.page';

const routes: Routes = [
  {
    path: '',
    component: TokenDetailsPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TokenDetailsPageRoutingModule {}
