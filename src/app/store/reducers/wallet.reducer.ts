import { Action, createReducer, on } from '@ngrx/store';

import { noWallet } from 'src/app/extras/noWallet';
import { WalletStateInterface } from 'src/app/models/types/states/walletState.interface';
import {
  getWalletAction,
  getWalletSuccessAction,
  getWalletFailureAction,
  listWalletsAction,
  listWalletsSuccessAction,
  listWalletsFailureAction,
} from 'src/app/store/actions/wallet.action';
import {
  deleteAccountSuccessAction,
  logoutSuccessAction,
} from 'src/app/store/actions/auth.action';

const initialState: WalletStateInterface = {
  isLoading: false,
  wallet: null,
  leaderboard: null,
  error: null,
};

const walletReducer = createReducer(
  initialState,

  // Get Wallet Reducers
  on(
    getWalletAction,
    (state): WalletStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(getWalletSuccessAction, (state, action): WalletStateInterface => {
    return {
      ...state,
      isLoading: false,
      wallet:
        action.payload.total !== 0 ? action.payload.documents[0] : noWallet,
    };
  }),
  on(
    getWalletFailureAction,
    (state, action): WalletStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),

  // List Wallets Reducers
  on(
    listWalletsAction,
    (state): WalletStateInterface => ({
      ...state,
      isLoading: true,
      error: null,
    })
  ),
  on(
    listWalletsSuccessAction,
    (state, action): WalletStateInterface => ({
      ...state,
      isLoading: true,
      leaderboard: action.payload.documents,
      error: null,
    })
  ),
  on(
    listWalletsFailureAction,
    (state, action): WalletStateInterface => ({
      ...state,
      isLoading: false,
      error: action.error,
    })
  ),

  // Set initialState after Logout/Delete Success Action
  on(
    logoutSuccessAction,
    deleteAccountSuccessAction,
    (): WalletStateInterface => ({
      ...initialState,
    })
  )
);

export function walletReducers(state: WalletStateInterface, action: Action) {
  return walletReducer(state, action);
}
