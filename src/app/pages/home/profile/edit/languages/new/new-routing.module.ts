import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { NewPage } from './new.page';

const routes: Routes = [
  {
    path: '',
    component: NewPage,
  },
  {
    path: 'next',
    loadChildren: () =>
      import('./next/next.module').then((m) => m.NextPageModule),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class NewPageRoutingModule {}
