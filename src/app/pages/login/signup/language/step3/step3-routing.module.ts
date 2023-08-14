import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { Step3Page } from './step3.page';

const routes: Routes = [
  {
    path: '',
    component: Step3Page
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class Step3PageRoutingModule {}
