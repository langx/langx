import { Wallet } from '@/models/Wallet';

export const sampleWallet: Wallet = {
  $collectionId: 'collectionId',
  $createdAt: new Date().toISOString(),
  $databaseId: 'databaseId',
  $id: 'id',
  $permissions: [],
  $updatedAt: new Date().toISOString(),
  balance: 12345,
};
