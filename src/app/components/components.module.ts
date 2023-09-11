import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { EmptyScreenComponent } from './empty-screen/empty-screen.component';

@NgModule({
  declarations: [EmptyScreenComponent],
  imports: [CommonModule, IonicModule],
  exports: [EmptyScreenComponent],
})
export class ComponentsModule {}
