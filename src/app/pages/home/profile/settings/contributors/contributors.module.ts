import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ContributorsPageRoutingModule } from './contributors-routing.module';

import { ContributorsPage } from './contributors.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ContributorsPageRoutingModule
  ],
  declarations: [ContributorsPage]
})
export class ContributorsPageModule {}
