import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { EnthusiastsPageRoutingModule } from './enthusiasts-routing.module';

import { EnthusiastsPage } from './enthusiasts.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    EnthusiastsPageRoutingModule
  ],
  declarations: [EnthusiastsPage]
})
export class EnthusiastsPageModule {}
