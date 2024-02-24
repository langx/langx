import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EffectsModule } from '@ngrx/effects';
import { IonicModule } from '@ionic/angular';
import { StoreModule } from '@ngrx/store';

import { SponsorsPageRoutingModule } from './sponsors-routing.module';
import { SponsorsPage } from './sponsors.page';
import { ComponentsModule } from 'src/app/components/components.module';
import { sponsorReducers } from 'src/app/store/reducers/sponsors.reducer';
import { SponsorsEffects } from 'src/app/store/effects/sponsors.effect';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SponsorsPageRoutingModule,
    ComponentsModule,
    StoreModule.forFeature('sponsor', sponsorReducers),
    EffectsModule.forFeature([SponsorsEffects]),
  ],
  declarations: [SponsorsPage],
})
export class SponsorsPageModule {}
