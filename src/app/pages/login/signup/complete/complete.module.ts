import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CompletePageRoutingModule } from './complete-routing.module';

import { CompletePage } from './complete.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CompletePageRoutingModule
  ],
  declarations: [CompletePage]
})
export class CompletePageModule {}
