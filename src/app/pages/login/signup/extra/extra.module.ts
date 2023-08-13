import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ExtraPageRoutingModule } from './extra-routing.module';

import { ExtraPage } from './extra.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ExtraPageRoutingModule
  ],
  declarations: [ExtraPage]
})
export class ExtraPageModule {}
