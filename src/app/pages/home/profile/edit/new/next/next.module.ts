import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { NextPageRoutingModule } from './next-routing.module';

import { NextPage } from './next.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, NextPageRoutingModule],
  declarations: [NextPage],
})
export class NextPageModule {}
