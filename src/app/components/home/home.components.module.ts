import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

// Home Components
import { TargetLanguageComponent } from './target-language/target-language.component';

// Pipes
import { AppExtrasModule } from 'src/app/app.extras.module';

@NgModule({
  declarations: [TargetLanguageComponent],
  imports: [CommonModule, IonicModule, AppExtrasModule],
  exports: [TargetLanguageComponent],
})
export class ProfileComponentsModule {}
