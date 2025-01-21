export interface CompleteRegistrationRequestInterface {
  name: string;
  birthdate: Date;
  country: string;
  countryCode: string;
  gender: string;
  lastSeen: Date;
  motherLanguages: string[];
  studyLanguages: string[];
}
