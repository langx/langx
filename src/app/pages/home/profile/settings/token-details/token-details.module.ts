import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { TokenDetailsPageRoutingModule } from './token-details-routing.module';

import { TokenDetailsPage } from './token-details.page';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { checkoutsReducers } from 'src/app/store/reducers/checkouts.reducer';
import { CheckoutsEffects } from 'src/app/store/effects/checkouts.effect';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TokenDetailsPageRoutingModule,
    StoreModule.forFeature('checkout', checkoutsReducers),
    EffectsModule.forFeature([CheckoutsEffects]),
  ],
  declarations: [TokenDetailsPage],
})
export class TokenDetailsPageModule {}
