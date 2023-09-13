import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { Chat2Page } from './chat2.page';

const routes: Routes = [
  {
    path: '',
    component: Chat2Page
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class Chat2PageRoutingModule {}
