import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { TokenDetailsPageRoutingModule } from './token-details-routing.module';

import { TokenDetailsPage } from './token-details.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TokenDetailsPageRoutingModule,
  ],
  declarations: [TokenDetailsPage],
})
export class TokenDetailsPageModule {}
