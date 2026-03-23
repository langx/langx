import React from 'react';
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { ThemedView } from '@/components/themed/atomic/ThemedView';
import { ThemedText } from '@/components/themed/atomic/ThemedText';
import { isBirthday } from '@/constants/utils';

interface BirthdayBannerProps {
  birthdate: string | Date;
  name?: string;
}

const BirthdayBanner = ({ birthdate, name }: BirthdayBannerProps) => {
  if (!isBirthday(birthdate)) return null;

  return (
    <ThemedView style={styles.banner}>
      <ThemedText style={styles.emoji}>🎂</ThemedText>
      <ThemedText style={styles.text}>
        Happy Birthday{name ? `, ${name}` : ''}!
      </ThemedText>
      <ThemedText style={styles.subtext}>
        Wish them a happy birthday!
      </ThemedText>
    </ThemedView>
  );
};

export default BirthdayBanner;

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.light.primary,
    borderRadius: 10,
    padding: 16,
    marginHorizontal: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 40,
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  text: {
    fontSize: 20,
    fontFamily: 'Lexend-Bold',
    color: Colors.light.black,
    textAlign: 'center',
    backgroundColor: 'transparent',
  },
  subtext: {
    fontSize: 14,
    color: Colors.light.black,
    textAlign: 'center',
    marginTop: 4,
    backgroundColor: 'transparent',
  },
});
