import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { LanguagesPage } from './languages.page';

const routes: Routes = [
  {
    path: '',
    component: LanguagesPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LanguagesPageRoutingModule {}