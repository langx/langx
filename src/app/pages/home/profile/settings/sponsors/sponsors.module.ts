import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SponsorsPageRoutingModule } from './sponsors-routing.module';

import { SponsorsPage } from './sponsors.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, SponsorsPageRoutingModule],
  declarations: [SponsorsPage],
})
export class SponsorsPageModule {}
