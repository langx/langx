import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SignupPage } from './signup.page';
import { AuthGuard } from 'src/app/guards/auth/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: SignupPage
  },
  {
    path: 'complete',
    loadChildren: () => import('./complete/complete.module').then( m => m.CompletePageModule),
    canLoad: [AuthGuard]
  },
  {
    path: 'language',
    loadChildren: () => import('./language/language.module').then( m => m.LanguagePageModule),
    canLoad: [AuthGuard]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SignupPageRoutingModule {}