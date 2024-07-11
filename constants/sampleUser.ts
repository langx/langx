import { User } from '@/models/User';

export const sampleUser: User = {
  name: 'Jane Smith',
  country: 'Canada',
  countryCode: 'CA',
  gender: 'male',
  birthdate: new Date('1995-05-15'),
  username: 'janesmith',
  languageArray: ['English', 'French'],
  motherLanguages: ['English'],
  studyLanguages: ['French', 'Spanish'],
  languages: [
    { name: 'English', proficiency: 'native' },
    { name: 'French', proficiency: 'intermediate' },
    { name: 'Spanish', proficiency: 'beginner' },
  ],
  badges: ['polyglot', 'early_bird'],
  aboutMe:
    'Passionate about languages and cultures. Love to travel and meet new people.',
  lastSeen: new Date(new Date().getTime() - 60000),
  totalUnseen: 5,
  totalUnseenArchived: 2,
  notifications: ['new_message', 'new_friend_request'],
  notificationsArray: ['new_message', 'new_friend_request'],
  blockedUsers: [],
  archivedRooms: [],
  privacy: [],
  contributors: [],
  sponsor: false,
  streaks: {
    currentStreak: 10,
    longestStreak: 25,
    lastActivity: new Date('2024-07-01'),
  },
  profilePic: 'profile.png',
  otherPics: ['pic1URL', 'pic2URL', 'pic3URL'],
};
