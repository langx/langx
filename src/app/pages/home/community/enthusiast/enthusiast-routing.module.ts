import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { EnthusiastPage } from './enthusiast.page';

const routes: Routes = [
  {
    path: '',
    component: EnthusiastPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EnthusiastPageRoutingModule {}
