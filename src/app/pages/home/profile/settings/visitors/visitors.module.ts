import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { VisitorsPageRoutingModule } from './visitors-routing.module';
import { VisitorsPage } from './visitors.page';

import { ComponentsModule } from 'src/app/components/components.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    VisitorsPageRoutingModule,
    ComponentsModule,
  ],
  declarations: [VisitorsPage],
})
export class VisitorsPageModule {}
