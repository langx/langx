// oauth2-callback-routing.module.ts
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { Oauth2CallbackComponent } from './oauth2-callback.component';

const routes: Routes = [
  {
    path: '',
    component: Oauth2CallbackComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class Oauth2CallbackRoutingModule {}
