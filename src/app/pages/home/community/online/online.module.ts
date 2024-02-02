import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { OnlinePageRoutingModule } from './online-routing.module';

import { OnlinePage } from './online.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, OnlinePageRoutingModule],
  declarations: [OnlinePage],
})
export class OnlinePageModule {}
