import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { EffectsModule } from '@ngrx/effects';

import { VisitorsPageRoutingModule } from './visitors-routing.module';
import { VisitorsPage } from './visitors.page';
import { ComponentsModule } from 'src/app/components/components.module';
import { VisitsEffects } from 'src/app/store/effects/visits.effect';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    VisitorsPageRoutingModule,
    ComponentsModule,
    //StoreModule.forFeature('visit', visitReducers),
    EffectsModule.forFeature([VisitsEffects]),
  ],
  declarations: [VisitorsPage],
})
export class VisitorsPageModule {}
