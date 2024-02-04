import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CommunityPage } from './community.page';

const routes: Routes = [
  {
    path: '',
    component: CommunityPage,
  },
  {
    path: 'online',
    loadChildren: () =>
      import('./online/online.module').then((m) => m.OnlinePageModule),
  },
  {
    path: 'new',
    loadChildren: () => import('./new/new.module').then((m) => m.NewPageModule),
  },
  {
    path: 'target-language',
    loadChildren: () =>
      import('./target-language/target-language.module').then(
        (m) => m.TargetLanguagePageModule
      ),
  },
  {
    path: 'enthusiast',
    loadChildren: () =>
      import('./enthusiast/enthusiast.module').then(
        (m) => m.EnthusiastPageModule
      ),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CommunityPageRoutingModule {}
