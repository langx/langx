import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { ComponentsModule } from '../components.module';

// Pipes
import { AppExtrasModule } from 'src/app/app.extras.module';

// Home Components
import { TargetLanguageComponent } from './target-language/target-language.component';
import { EnthusiastComponent } from './enthusiast/enthusiast.component';
import { NewComponent } from './new/new.component';
import { OnlineComponent } from './online/online.component';
import { VisitorsComponent } from './visitors/visitors.component';

@NgModule({
  declarations: [
    TargetLanguageComponent,
    EnthusiastComponent,
    NewComponent,
    OnlineComponent,
    VisitorsComponent,
  ],
  imports: [CommonModule, IonicModule, ComponentsModule, AppExtrasModule],
  exports: [
    TargetLanguageComponent,
    EnthusiastComponent,
    NewComponent,
    OnlineComponent,
    VisitorsComponent,
  ],
})
export class HomeComponentsModule {}
