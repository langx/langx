import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { Oauth2PageRoutingModule } from './oauth2-routing.module';

import { Oauth2Page } from './oauth2.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    Oauth2PageRoutingModule
  ],
  declarations: [Oauth2Page]
})
export class Oauth2PageModule {}
