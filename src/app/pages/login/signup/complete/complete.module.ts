import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CompletePageRoutingModule } from './complete-routing.module';

import { CompletePage } from './complete.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    CompletePageRoutingModule
  ],
  declarations: [CompletePage]
})
export class CompletePageModule {}
