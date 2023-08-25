import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { FiltersPageRoutingModule } from './filters-routing.module';

import { FiltersPage } from './filters.page';
import { LanguageLevelModalComponent } from 'src/app/components/language-level-modal/language-level-modal.component';
import { AppExtrasModule } from 'src/app/app.extras.module';
import { FormsModule } from '@angular/forms';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    FiltersPageRoutingModule,
    AppExtrasModule
  ],
  declarations: [FiltersPage, LanguageLevelModalComponent]
})
export class FiltersPageModule {}
