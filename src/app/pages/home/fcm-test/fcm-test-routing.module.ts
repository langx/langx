import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { FcmTestPage } from './fcm-test.page';

const routes: Routes = [
  {
    path: '',
    component: FcmTestPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FcmTestPageRoutingModule {}
