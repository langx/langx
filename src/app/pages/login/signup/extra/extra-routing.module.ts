import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ExtraPage } from './extra.page';

const routes: Routes = [
  {
    path: '',
    component: ExtraPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ExtraPageRoutingModule {}
