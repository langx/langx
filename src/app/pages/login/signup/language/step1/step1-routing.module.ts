import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { Step1Page } from './step1.page';

const routes: Routes = [
  {
    path: '',
    component: Step1Page
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class Step1PageRoutingModule {}
