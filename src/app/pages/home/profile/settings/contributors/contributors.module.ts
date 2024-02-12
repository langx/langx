import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EffectsModule } from '@ngrx/effects';
import { IonicModule } from '@ionic/angular';
import { StoreModule } from '@ngrx/store';

import { ContributorsPageRoutingModule } from './contributors-routing.module';
import { ContributorsPage } from './contributors.page';
import { ComponentsModule } from 'src/app/components/components.module';
import { contributorsReducers } from 'src/app/store/reducers/contributors.reducer';
import { ContributorsEffects } from 'src/app/store/effects/contributors.effect';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ContributorsPageRoutingModule,
    ComponentsModule,
    StoreModule.forFeature('contributor', contributorsReducers),
    EffectsModule.forFeature([ContributorsEffects]),
  ],
  declarations: [ContributorsPage],
})
export class ContributorsPageModule {}
