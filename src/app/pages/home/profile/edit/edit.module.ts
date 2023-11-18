import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { EditPageRoutingModule } from './edit-routing.module';
import { ImageCropperModule } from 'ngx-image-cropper';

import { EditPage } from './edit.page';
import { ComponentsModule } from 'src/app/components/components.module';
import { ImageCropComponent } from 'src/app/components/image-crop/image-crop.component';
import { EditLanguageComponent } from 'src/app/components/edit-language/edit-language/edit-language.component';
import { AddLanguageComponent } from 'src/app/components/add-language/add-language/add-language.component';
import { AppExtrasModule } from 'src/app/app.extras.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    EditPageRoutingModule,
    ComponentsModule,
    ImageCropperModule,
    AppExtrasModule,
  ],
  declarations: [
    EditPage,
    ImageCropComponent,
    EditLanguageComponent,
    AddLanguageComponent,
  ],
})
export class EditPageModule {}
