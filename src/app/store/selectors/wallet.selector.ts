import { createFeatureSelector, createSelector } from '@ngrx/store';

import { WalletStateInterface } from 'src/app/models/types/states/walletState.interface';

export const walletFeatureSelector =
  createFeatureSelector<WalletStateInterface>('wallet');

export const isLoadingSelector = createSelector(
  walletFeatureSelector,
  (walletState: WalletStateInterface) => walletState.isLoading
);
export const walletSelector = createSelector(
  walletFeatureSelector,
  (walletState: WalletStateInterface) => walletState.wallet
);

export const errorSelector = createSelector(
  walletFeatureSelector,
  (walletState: WalletStateInterface) => walletState.error
);
