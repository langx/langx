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
    path: 'chat',
    redirectTo: 'messages',
  },
  {
    path: 'messages/archive',
    loadChildren: () =>
      import('./messages/archive/archive.module').then(
        (m) => m.ArchivePageModule
      ),
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
    path: 'user',
    redirectTo: 'community',
  },
  {
    path: 'edit',
    loadChildren: () =>
      import('./profile/settings/edit/edit.module').then(
        (m) => m.EditPageModule
      ),
  },
  {
    path: 'account',
    loadChildren: () =>
      import('./profile/settings/account/account.module').then(
        (m) => m.AccountPageModule
      ),
  },
  {
    path: 'account/update-password',
    loadChildren: () =>
      import(
        './profile/settings/account/update-password/update-password.module'
      ).then((m) => m.UpdatePasswordPageModule),
  },
  {
    path: 'account/blocked-users',
    loadChildren: () =>
      import(
        './profile/settings/privacy/blocked-users/blocked-users.module'
      ).then((m) => m.BlockedUsersPageModule),
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
    path: 'visitors',
    loadChildren: () =>
      import('./profile/settings/visitors/visitors.module').then(
        (m) => m.VisitorsPageModule
      ),
  },
  {
    path: 'leaderboard',
    loadChildren: () =>
      import('./profile/settings/leaderboard/leaderboard.module').then(
        (m) => m.LeaderboardPageModule
      ),
  },
  {
    path: 'about-us',
    loadChildren: () =>
      import('./profile/settings/about-us/about-us.module').then(
        (m) => m.AboutUsPageModule
      ),
  },
  {
    path: 'contributors',
    loadChildren: () =>
      import('./profile/settings/contributors/contributors.module').then(
        (m) => m.ContributorsPageModule
      ),
  },
  {
    path: 'sponsors',
    loadChildren: () =>
      import('./profile/settings/backers/backers.module').then(
        (m) => m.BackersPageModule
      ),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class HomePageRoutingModule {}
