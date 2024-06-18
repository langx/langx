import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TokenLeaderboardPage } from './token-leaderboard.page';

const routes: Routes = [
  {
    path: '',
    component: TokenLeaderboardPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TokenLeaderboardPageRoutingModule {}
