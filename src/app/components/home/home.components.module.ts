import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { ComponentsModule } from '../components.module';

// Home Components
import { TargetLanguageComponent } from './target-language/target-language.component';

// Pipes
import { AppExtrasModule } from 'src/app/app.extras.module';

@NgModule({
  declarations: [TargetLanguageComponent],
  imports: [CommonModule, IonicModule, ComponentsModule, AppExtrasModule],
  exports: [TargetLanguageComponent],
})
export class HomeComponentsModule {}
