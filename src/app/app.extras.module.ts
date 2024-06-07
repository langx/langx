import { NgModule } from '@angular/core';

import { CustomFilterPipe } from 'src/app/extras/custom-filter.pipe';
import { DateMaskPipe } from 'src/app/extras/date-mask.pipe';
import { CapitalizeFirstPipe } from './extras/capitalizeFirst.pipe';
import { BigNumbersPipe } from 'src/app/extras/bigNumbers.pipe';

@NgModule({
  imports: [],
  declarations: [
    CustomFilterPipe,
    DateMaskPipe,
    CapitalizeFirstPipe,
    BigNumbersPipe,
  ],
  exports: [
    CustomFilterPipe,
    DateMaskPipe,
    CapitalizeFirstPipe,
    BigNumbersPipe,
  ],
})
export class AppExtrasModule {}
