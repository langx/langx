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
    path: 'auth/provider/:name',
    loadChildren: () =>
      import('./pages/auth/provider/provider.module').then(
        (m) => m.ProviderPageModule
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
  {
    path: '**',
    loadChildren: () =>
      import('./pages/not-found/not-found.module').then(
        (m) => m.NotFoundPageModule
      ),
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: PreloadAllModules,
      canceledNavigationResolution:
        'replace' /* or 'computed' based on your requirement */,
      paramsInheritanceStrategy:
        'emptyOnly' /* or 'always' based on your requirement */,
      urlUpdateStrategy: 'deferred' /* or 'eager' based on your requirement */,
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
