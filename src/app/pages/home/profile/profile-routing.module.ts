import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ProfilePage } from './profile.page';

const routes: Routes = [
  {
    path: '',
    component: ProfilePage
  },
  {
    path: 'account',
    loadChildren: () => import('./settings/account/account.module').then( m => m.AccountPageModule)
  },
  {
    path: 'notifications',
    loadChildren: () => import('./settings/notifications/notifications.module').then( m => m.NotificationsPageModule)
  },
  {
    path: 'privacy',
    loadChildren: () => import('./settings/privacy/privacy.module').then( m => m.PrivacyPageModule)
  },
  {
    path: 'appearance',
    loadChildren: () => import('./settings/appearance/appearance.module').then( m => m.AppearancePageModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ProfilePageRoutingModule {}
