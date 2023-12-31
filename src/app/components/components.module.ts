import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { EmptyScreenComponent } from 'src/app/components/empty-screen/empty-screen.component';
import { Oauth2Component } from 'src/app/components/oauth2/oauth2.component';

@NgModule({
  declarations: [EmptyScreenComponent, Oauth2Component],
  imports: [CommonModule, IonicModule],
  exports: [EmptyScreenComponent, Oauth2Component],
})
export class ComponentsModule {}
