import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { OnlinePageRoutingModule } from './online-routing.module';

import { OnlinePage } from './online.page';
import { ComponentsModule } from 'src/app/components/components.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    OnlinePageRoutingModule,
    ComponentsModule,
  ],
  declarations: [OnlinePage],
})
export class OnlinePageModule {}
