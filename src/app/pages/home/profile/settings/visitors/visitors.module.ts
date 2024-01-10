import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { VisitorsPageRoutingModule } from './visitors-routing.module';

import { VisitorsPage } from './visitors.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    VisitorsPageRoutingModule
  ],
  declarations: [VisitorsPage]
})
export class VisitorsPageModule {}
