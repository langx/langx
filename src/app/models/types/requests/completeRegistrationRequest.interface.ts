export interface CompleteRegistrationRequestInterface {
  name: string;
  birthdate: Date;
  country: string;
  countryCode: string;
  gender: string;
  lastSeen: Date;
  badges?: string[];
  notifications?: string[];
  notificationsArray?: string[];
}
