import { language2Country } from '@/constants/language2Country';

export const getFlagEmoji = (country: string) => {
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
  const birthDate = new Date(birthdate);
  const ageDiffMs = Date.now() - birthDate.getTime();
  const ageDate = new Date(ageDiffMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

export const lastSeen = (lastSeenDate: string) => {
  const lastSeenTime = new Date(lastSeenDate).getTime();
  const currentTime = new Date().getTime();
  const diffMinutes = Math.floor((currentTime - lastSeenTime) / (1000 * 60));

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minutes`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hours`;
  return `${Math.floor(diffMinutes / 1440)} days`;
};
