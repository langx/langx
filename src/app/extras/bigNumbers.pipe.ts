import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'bigNumbers',
})
export class BigNumbersPipe implements PipeTransform {
  transform(value: any): any {
    if (isNaN(value)) return value;

    if (value >= 1000000000) {
      return (value / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
    }
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return value;
  }
}
