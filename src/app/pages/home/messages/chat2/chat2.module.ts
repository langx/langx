import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { Chat2PageRoutingModule } from './chat2-routing.module';

import { Chat2Page } from './chat2.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    Chat2PageRoutingModule
  ],
  declarations: [Chat2Page]
})
export class Chat2PageModule {}
