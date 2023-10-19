import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { HomePage } from './home.page';

const routes: Routes = [
  {
    path: '',
    component: HomePage,
    children: [
      {
        path: '',
        redirectTo: 'community',
        pathMatch: 'full',
      },
      {
        path: 'messages',
        loadChildren: () =>
          import('./messages/messages.module').then(
            (m) => m.MessagesPageModule
          ),
      },
      {
        path: 'community',
        loadChildren: () =>
          import('./community/community.module').then(
            (m) => m.CommunityPageModule
          ),
      },
      {
        path: 'profile',
        loadChildren: () =>
          import('./profile/profile.module').then((m) => m.ProfilePageModule),
      },
    ],
  },
  {
    path: 'chat/:id',
    loadChildren: () =>
      import('./messages/chat/chat.module').then((m) => m.ChatPageModule),
  },
  {
    path: 'filters',
    loadChildren: () =>
      import('./community/filters/filters.module').then(
        (m) => m.FiltersPageModule
      ),
  },
  {
    path: 'user/:id',
    loadChildren: () =>
      import('./user/user.module').then((m) => m.UserPageModule),
  },
  {
    path: 'profile/edit',
    loadChildren: () =>
      import('./profile/edit/edit.module').then((m) => m.EditPageModule),
  },
  {
    path: 'account',
    loadChildren: () =>
      import('./profile/settings/account/account.module').then(
        (m) => m.AccountPageModule
      ),
  },
  {
    path: 'appearance',
    loadChildren: () =>
      import('./profile/settings/appearance/appearance.module').then(
        (m) => m.AppearancePageModule
      ),
  },
  {
    path: 'notifications',
    loadChildren: () =>
      import('./profile/settings/notifications/notifications.module').then(
        (m) => m.NotificationsPageModule
      ),
  },
  {
    path: 'privacy',
    loadChildren: () =>
      import('./profile/settings/privacy/privacy.module').then(
        (m) => m.PrivacyPageModule
      ),
  },
  {
    path: 'fcm-test',
    loadChildren: () =>
      import('./fcm-test/fcm-test.module').then((m) => m.FcmTestPageModule),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class HomePageRoutingModule {}
