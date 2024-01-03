import { Component, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { SuccessPageRoutingModule } from './success-routing.module';
import { SuccessPage } from './success.page';
import { ComponentsModule } from 'src/app/components/components.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SuccessPageRoutingModule,
    ComponentsModule,
  ],
  declarations: [SuccessPage],
})
export class SuccessPageModule {}
