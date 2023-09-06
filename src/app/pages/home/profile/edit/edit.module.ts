import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { EditPageRoutingModule } from './edit-routing.module';
import { ImageCropperModule } from 'ngx-image-cropper';

import { EditPage } from './edit.page';
import { ComponentsModule } from 'src/app/components/components.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    EditPageRoutingModule,
    ComponentsModule,
    ImageCropperModule
  ],
  declarations: [EditPage]
})
export class EditPageModule {}