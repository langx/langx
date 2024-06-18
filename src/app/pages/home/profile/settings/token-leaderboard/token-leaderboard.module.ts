import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { TokenLeaderboardPageRoutingModule } from './token-leaderboard-routing.module';

import { TokenLeaderboardPage } from './token-leaderboard.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TokenLeaderboardPageRoutingModule,
  ],
  declarations: [TokenLeaderboardPage],
})
export class TokenLeaderboardPageModule {}
