import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';

import { SignupPageRoutingModule } from './signup-routing.module';
import { SignupPage } from './signup.page';
import { reducers } from 'src/app/store/reducers/register.reducer';
import { RegisterEffect } from 'src/app/store/effects/register.effects';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    SignupPageRoutingModule,
    StoreModule.forFeature('auth', reducers),
    EffectsModule.forFeature([RegisterEffect]),
  ],
  declarations: [SignupPage],
})
export class SignupPageModule {}
