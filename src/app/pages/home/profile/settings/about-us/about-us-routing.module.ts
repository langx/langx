import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AboutUsPage } from './about-us.page';

const routes: Routes = [
  {
    path: '',
    component: AboutUsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AboutUsPageRoutingModule {}
