import { Component, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { EnthusiastPageRoutingModule } from './enthusiast-routing.module';

import { EnthusiastPage } from './enthusiast.page';
import { ComponentsModule } from 'src/app/components/components.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    EnthusiastPageRoutingModule,
    ComponentsModule,
  ],
  declarations: [EnthusiastPage],
})
export class EnthusiastPageModule {}
