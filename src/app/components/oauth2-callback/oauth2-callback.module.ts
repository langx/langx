// oauth2-callback.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Oauth2CallbackComponent } from './oauth2-callback.component';
import { Oauth2CallbackRoutingModule } from './oauth2-callback-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    Oauth2CallbackRoutingModule,
  ],
  declarations: [Oauth2CallbackComponent],
})
export class Oauth2CallbackModule {}
