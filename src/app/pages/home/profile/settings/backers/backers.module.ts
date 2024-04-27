import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EffectsModule } from '@ngrx/effects';
import { IonicModule } from '@ionic/angular';
import { StoreModule } from '@ngrx/store';

import { BackersPageRoutingModule } from './backers-routing.module';
import { BackersPage } from './backers.page';
import { ComponentsModule } from 'src/app/components/components.module';
import { sponsorReducers } from 'src/app/store/reducers/sponsors.reducer';
import { SponsorsEffects } from 'src/app/store/effects/sponsors.effect';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BackersPageRoutingModule,
    ComponentsModule,
    StoreModule.forFeature('sponsor', sponsorReducers),
    EffectsModule.forFeature([SponsorsEffects]),
  ],
  declarations: [BackersPage],
})
export class BackersPageModule {}
