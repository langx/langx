import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { EnthusiastsPage } from './enthusiasts.page';

const routes: Routes = [
  {
    path: '',
    component: EnthusiastsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EnthusiastsPageRoutingModule {}
