import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { UpdatePasswordPageRoutingModule } from './update-password-routing.module';

import { UpdatePasswordPage } from './update-password.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    UpdatePasswordPageRoutingModule,
  ],
  declarations: [UpdatePasswordPage],
})
export class UpdatePasswordPageModule {}
