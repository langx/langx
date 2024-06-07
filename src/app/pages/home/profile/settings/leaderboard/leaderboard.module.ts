import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { LeaderboardPageRoutingModule } from './leaderboard-routing.module';

import { LeaderboardPage } from './leaderboard.page';
import { ComponentsModule } from 'src/app/components/components.module';
import { streaksReducers } from 'src/app/store/reducers/streaks.reducer';
import { StreaksEffects } from 'src/app/store/effects/streaks.effect';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    LeaderboardPageRoutingModule,
    ComponentsModule,
    StoreModule.forFeature('streak', streaksReducers),
    EffectsModule.forFeature([StreaksEffects]),
  ],
  declarations: [LeaderboardPage],
})
export class LeaderboardPageModule {}
