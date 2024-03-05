import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { LeaderboardPage } from './leaderboard.page';

const routes: Routes = [
  {
    path: '',
    component: LeaderboardPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LeaderboardPageRoutingModule {}
