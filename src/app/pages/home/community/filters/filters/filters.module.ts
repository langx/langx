import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { FiltersPageRoutingModule } from './filters-routing.module';

import { FiltersPage } from './filters.page';
import { LanguageLevelModalComponent } from 'src/app/components/language-level-modal/language-level-modal.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    FiltersPageRoutingModule,
    ReactiveFormsModule
  ],
  declarations: [FiltersPage, LanguageLevelModalComponent]
})
export class FiltersPageModule {}
