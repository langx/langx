import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'customFilter'
})
export class CustomFilterPipe implements PipeTransform {

  transform(items: any, term: string, excludes: any = []): any {
    if (!term || !items) return items;
    return CustomFilterPipe.filter(items, term, excludes);
  }

  static filter(
    items: Array<{ [key: string]: any }>,
    term: string,
    excludes: any
  ): Array<{ [key: string]: any }> {
    const toCompare = term.toLowerCase();

    function checkInside(item: any, term: string) {
      if (
        typeof item === "string" &&
        item
          .toString()
          .toLowerCase()
          .includes(toCompare)
      ) {
        return true;
      }

      for (let property in item) {
        if (
          item[property] === null ||
          item[property] == undefined ||
          excludes.includes(property)
        ) {
          continue;
        }

        if (typeof item[property] === "object") {
          if (checkInside(item[property], term)) {
            return true;
          }
        } else if (
          item[property]
            .toString()
            .toLowerCase()
            .includes(toCompare)
        ) {
          return true;
        }
      }
      return false;
    }

    return items.filter(function (item) {
      return checkInside(item, term);
    });
  }
}