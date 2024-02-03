import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TargetLanguagePage } from './target-language.page';

const routes: Routes = [
  {
    path: '',
    component: TargetLanguagePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TargetLanguagePageRoutingModule {}
