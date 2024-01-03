import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth/auth.guard';

const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./pages/login/login.module').then((m) => m.LoginPageModule),
  },
  {
    path: 'login',
    redirectTo: '',
    pathMatch: 'full',
  },
  {
    path: 'home',
    loadChildren: () =>
      import('./pages/home/home.module').then((m) => m.HomePageModule),
    canLoad: [AuthGuard],
  },
  {
    path: 'auth/success',
    loadChildren: () =>
      import('./pages/auth/oauth2/success/success.module').then(
        (m) => m.SuccessPageModule
      ),
  },
  {
    path: 'auth/oauth2/success',
    loadChildren: () =>
      import('./pages/auth/oauth2/success/success.module').then(
        (m) => m.SuccessPageModule
      ),
  },
  {
    path: 'auth/oauth2/failure',
    redirectTo: 'login',
  },
  {
    path: 'auth/verify-email',
    loadChildren: () =>
      import('./pages/auth/verify-email/verify-email.module').then(
        (m) => m.VerifyEmailPageModule
      ),
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
