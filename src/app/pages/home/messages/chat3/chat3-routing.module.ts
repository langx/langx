import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { Chat3Page } from './chat3.page';

const routes: Routes = [
  {
    path: '',
    component: Chat3Page
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class Chat3PageRoutingModule {}
