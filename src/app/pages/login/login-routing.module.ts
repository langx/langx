import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { LoginPage } from './login.page';

const routes: Routes = [
  {
    path: '',
    component: LoginPage,
  },
  {
    path: 'signup',
    loadChildren: () =>
      import('./signup/signup.module').then((m) => m.SignupPageModule),
  },
  {
    path: 'reset-password',
    loadChildren: () =>
      import('./reset-password/reset-password.module').then(
        (m) => m.ResetPasswordPageModule
      ),
  },
  {
    path: 'oauth2',
    redirectTo: '/login',
  },
  {
    path: 'oauth2/:token',
    loadChildren: () =>
      import('./oauth2/oauth2.module').then((m) => m.Oauth2PageModule),
  },
  {
    path: 'oauth2-callback',
    loadChildren: () =>
      import('src/app/components/oauth2-callback/oauth2-callback.module').then(
        (m) => m.Oauth2CallbackModule
      ),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LoginPageRoutingModule {}
