import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'dateMask'
})
export class DateMaskPipe implements PipeTransform {
  transform(value: any): any {
    if (!value) {
      return value;
    }

    let maskedValue = value.replace(/[^0-9]/g, '');
    if (maskedValue.length > 2) {
      maskedValue = maskedValue.slice(0, 2) + '/' + maskedValue.slice(2);
    }
    if (maskedValue.length > 5) {
      maskedValue = maskedValue.slice(0, 5) + '/' + maskedValue.slice(5);
    }
    return maskedValue;
  }
}