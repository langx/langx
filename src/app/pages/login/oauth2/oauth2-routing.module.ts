import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { Oauth2Page } from './oauth2.page';

const routes: Routes = [
  {
    path: '',
    component: Oauth2Page
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class Oauth2PageRoutingModule {}
