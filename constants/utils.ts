import { language2Country } from '@/constants/language2Country';

export const getFlagEmoji = (country: string) => {
  if (!country) return;
  const codePoints = country
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

export const getFlagEmoji2 = (languageCode: string) => {
  const countryCode = language2Country[languageCode];
  if (!countryCode) {
    return '🏳️'; // White flag emoji
  }
  if (countryCode === 'EO') {
    return '⭐';
  }
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt());
  return String.fromCodePoint(...codePoints);
};

export const getAge = (birthdate: string) => {
  if (!birthdate) return;
  const birthDate = new Date(birthdate);
  const ageDiffMs = Date.now() - birthDate.getTime();
  const ageDate = new Date(ageDiffMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

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

export function lastSeenExt(date: Date) {
  let now = new Date();
  let lastSeen = new Date(date);
  let diff = now.getTime() - lastSeen.getTime();
  let minutes = Math.floor(diff / 60000);
  let hours = Math.floor(minutes / 60);
  let days = Math.floor(hours / 24);
  let months = Math.floor(days / 30);
  let years = Math.floor(months / 12);
  if (years > 0) {
    return years + ' years';
  } else if (months > 0) {
    return months + ' months';
  } else if (days > 0) {
    return days + ' days';
  } else if (hours > 0) {
    return hours + ' hours';
  } else if (minutes > 1) {
    return minutes + ' minutes';
  } else {
    return 'less than a minute';
  }
}

export function onlineStatus(date: Date) {
  let now = new Date();
  let lastSeen = new Date(date);
  let diff = now.getTime() - lastSeen.getTime();
  let minutes = Math.floor(diff / 60000);
  let hours = Math.floor(minutes / 60);
  let days = Math.floor(hours / 24);

  if (minutes < 60) {
    return 'online';
  } else if (hours < 24) {
    return 'away';
  } else {
    return 'offline';
  }
}

export function onlineStatusInChatRoom(date: Date) {
  let now = new Date();
  let lastSeen = new Date(date);
  let diff = now.getTime() - lastSeen.getTime();
  let minutes = Math.floor(diff / 60000);
  let hours = Math.floor(minutes / 60);
  let days = Math.floor(hours / 24);

  if (minutes < 3) {
    return 'online';
  } else if (hours < 6) {
    return 'away';
  } else {
    return 'offline';
  }
}

export const bigNumber = (value: number) => {
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
};
