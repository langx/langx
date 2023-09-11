import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { LanguagePage } from './language.page';

const routes: Routes = [
  {
    path: '',
    component: LanguagePage,
    children: [
      {
        path: '',
        redirectTo: 'step1',
        pathMatch: 'full',
      },
      {
        path: 'step1',
        loadChildren: () =>
          import('./step1/step1.module').then((m) => m.Step1PageModule),
      },
      {
        path: 'step2',
        loadChildren: () =>
          import('./step2/step2.module').then((m) => m.Step2PageModule),
      },
      {
        path: 'step3',
        loadChildren: () =>
          import('./step3/step3.module').then((m) => m.Step3PageModule),
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LanguagePageRoutingModule {}
