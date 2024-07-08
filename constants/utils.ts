import { language2Country } from "@/constants/language2Country";

export function getFlagEmoji2(languageCode) {
  const countryCode = language2Country[languageCode];
  if (!countryCode) {
    return "🏳️"; // White flag emoji
  }
  if (countryCode === "EO") {
    return "⭐";
  }
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt());
  return String.fromCodePoint(...codePoints);
}
