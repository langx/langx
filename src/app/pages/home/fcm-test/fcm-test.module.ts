import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { FcmTestPageRoutingModule } from './fcm-test-routing.module';

import { FcmTestPage } from './fcm-test.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, FcmTestPageRoutingModule],
  declarations: [FcmTestPage],
})
export class FcmTestPageModule {}
