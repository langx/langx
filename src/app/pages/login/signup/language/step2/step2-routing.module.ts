import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { Step2Page } from './step2.page';

const routes: Routes = [
  {
    path: '',
    component: Step2Page
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class Step2PageRoutingModule {}
