import { CUSTOM_ELEMENTS_SCHEMA, Component, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { LoginPageRoutingModule } from './login-routing.module';

import { LoginPage } from './login.page';
import { IntroComponent } from 'src/app/components/intro/intro.component';
import { AutofillDirective } from 'src/app/directives/autofill.directive';
import { ComponentsModule } from 'src/app/components/components.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    LoginPageRoutingModule,
    ComponentsModule,
  ],
  declarations: [LoginPage, IntroComponent, AutofillDirective],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class LoginPageModule {}
