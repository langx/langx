import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AppearancePageRoutingModule } from './appearance-routing.module';

import { AppearancePage } from './appearance.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AppearancePageRoutingModule
  ],
  declarations: [AppearancePage]
})
export class AppearancePageModule {}
