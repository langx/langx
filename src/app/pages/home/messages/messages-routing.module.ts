import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { MessagesPage } from './messages.page';

const routes: Routes = [
  {
    path: '',
    component: MessagesPage,
  },
  {
    path: 'test',
    loadChildren: () =>
      import('./test/test.module').then((m) => m.TestPageModule),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MessagesPageRoutingModule {}
