import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';

import { VisitorsPageRoutingModule } from './visitors-routing.module';
import { VisitorsPage } from './visitors.page';

import { ComponentsModule } from 'src/app/components/components.module';
import { VisitsEffects } from 'src/app/store/effects/visits.effect';
import { visitsReducers } from 'src/app/store/reducers/visits.reducer';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    VisitorsPageRoutingModule,
    ComponentsModule,
    StoreModule.forFeature('visit', visitsReducers),
    EffectsModule.forFeature([VisitsEffects]),
  ],
  declarations: [VisitorsPage],
})
export class VisitorsPageModule {}
