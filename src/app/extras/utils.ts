import { FormControl } from '@angular/forms';

export function lastSeen(date: Date) {
  let now = new Date();
  let lastSeen = new Date(date);
  let diff = now.getTime() - lastSeen.getTime();
  let minutes = Math.floor(diff / 60000);
  let hours = Math.floor(minutes / 60);
  let days = Math.floor(hours / 24);
  let months = Math.floor(days / 30);
  let years = Math.floor(months / 12);
  if (years > 0) {
    return years + 'Y';
  } else if (months > 0) {
    return months + 'M';
  } else if (days > 0) {
    return days + 'd';
  } else if (hours > 0) {
    return hours + 'h';
  } else if (minutes > 1) {
    return minutes + 'm';
  } else {
    return 'online';
  }
}

export function getAge(date: Date) {
  let now = new Date();
  let birthDate = new Date(date);
  let diff = now.getTime() - birthDate.getTime();
  let age = Math.floor(diff / 31557600000);
  return age;
}

export function getBirthdate(age: number) {
  let now = new Date();
  let birthYear = now.getFullYear() - age;
  let birthDate = new Date(birthYear, now.getMonth(), now.getDate());
  return birthDate;
}

export function nameParts(name: string) {
  let result: string = '';
  let parts = name.split(' ');
  if (parts.length > 1) {
    result = parts[0] + ' ' + parts[parts.length - 1].charAt(0) + '.';
  } else {
    result = name;
  }
  return result;
}

export function dateValidator(control: FormControl) {
  const value = control.value;
  const datePattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  if (value && !value.match(datePattern)) {
    return { dateInvalid: true };
  }
  return null;
}
