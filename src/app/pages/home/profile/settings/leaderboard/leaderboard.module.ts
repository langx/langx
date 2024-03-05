import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { LeaderboardPageRoutingModule } from './leaderboard-routing.module';

import { LeaderboardPage } from './leaderboard.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    LeaderboardPageRoutingModule,
  ],
  declarations: [LeaderboardPage],
})
export class LeaderboardPageModule {}
