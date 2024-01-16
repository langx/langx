import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ProviderPage } from './provider.page';

const routes: Routes = [
  {
    path: '',
    component: ProviderPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ProviderPageRoutingModule {}
