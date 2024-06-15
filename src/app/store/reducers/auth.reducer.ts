import { Action, createReducer, on } from '@ngrx/store';

import { AuthStateInterface } from 'src/app/models/types/states/authState.interface';
import { totalUnseenMessagesSuccessAction } from 'src/app/store/actions/notification.action';
import {
  completeRegistrationAction,
  completeRegistrationFailureAction,
  completeRegistrationSuccessAction,
  isLoggedInAction,
  isLoggedInFailureAction,
  isLoggedInSuccessAction,
  isLoggedInSuccessCompleteRegistrationAction,
  languageSelectionAction,
  languageSelectionFailureAction,
  languageSelectionSuccessAction,
  listIdentitiesAction,
  listIdentitiesFailureAction,
  listIdentitiesSuccessAction,
  listSessionsAction,
  listSessionsFailureAction,
  listSessionsSuccessAction,
  loginAction,
  loginFailureAction,
  loginSuccessAction,
  logoutAction,
  logoutFailureAction,
  logoutSuccessAction,
  registerAction,
  registerFailureAction,
  registerSuccessAction,
  updateLanguageArrayAction,
  updateLanguageArrayFailureAction,
  updateLanguageArraySuccessAction,
  verifyEmailAction,
  verifyEmailFailureAction,
  verifyEmailSuccessAction,
  verifyEmailConfirmationAction,
  verifyEmailConfirmationFailureAction,
  verifyEmailConfirmationSuccessAction,
  resetPasswordAction,
  resetPasswordSuccessAction,
  resetPasswordFailureAction,
  resetPasswordConfirmationAction,
  resetPasswordConfirmationSuccessAction,
  resetPasswordConfirmationFailureAction,
  updatePasswordAction,
  updatePasswordSuccessAction,
  updatePasswordFailureAction,
  updatePasswordResetValuesAction,
  deleteAccountAction,
  deleteAccountSuccessAction,
  deleteAccountFailureAction,
  clearErrorsAction,
  isLoggedInSuccessLanguageSelectionAction,
  selectLanguagesAction,
  deleteIdentityAction,
  deleteIdentitySuccessAction,
  deleteIdentityFailureAction,
  deleteSessionAction,
  deleteSessionSuccessAction,
  deleteSessionFailureAction,
  syncDiscordRolesAction,
  syncDiscordRolesSuccessAction,
  syncDiscordRolesFailureAction,
} from 'src/app/store/actions/auth.action';
import {
  updatePresenceFailureAction,
  updatePresenceSuccessAction,
} from 'src/app/store/actions/presence.action';
import {
  getCurrentUserAction,
  getCurrentUserFailureAction,
  getCurrentUserSuccessAction,
  updateCurrentUserAction,
  updateCurrentUserFailureAction,
  updateCurrentUserSuccessAction,
  blockUserAction,
  blockUserSuccessAction,
  blockUserFailureAction,
  blockUserInitialStateAction,
  getBlockedUsersAction,
  getBlockedUsersSuccessAction,
  getBlockedUsersFailureAction,
  unBlockUserAction,
  unBlockUserFailureAction,
  unBlockUserSuccessAction,
  unBlockUserInitialStateAction,
} from 'src/app/store/actions/user.action';
import {
  createLanguageAction,
  createLanguageFailureAction,
  createLanguageSuccessAction,
  deleteLanguageAction,
  deleteLanguageFailureAction,
  deleteLanguageSuccessAction,
  updateLanguageAction,
  updateLanguageFailureAction,
  updateLanguageSuccessAction,
} from 'src/app/store/actions/language.action';
import {
  uploadOtherPhotosAction,
  uploadOtherPhotosFailureAction,
  uploadOtherPhotosSuccessAction,
  uploadProfilePictureAction,
  uploadProfilePictureFailureAction,
  uploadProfilePictureSuccessAction,
} from 'src/app/store/actions/bucket.action';
import {
  archiveRoomAction,
  archiveRoomFailureAction,
  archiveRoomInitialStateAction,
  archiveRoomSuccessAction,
  unArchiveRoomAction,
  unArchiveRoomFailureAction,
  unArchiveRoomInitialStateAction,
  unArchiveRoomSuccessAction,
} from 'src/app/store/actions/room.action';

const initialState: AuthStateInterface = {
  isLoading: false,
  account: null,
  currentUser: null,
  isLoggedIn: null,
  isCompletedRegistration: null,
  isCompletedLanguage: false,
  selectedLanguages: null,
  identities: null,
  sessions: null,
  verifyEmailSuccess: false,
  verifyEmailConfirmationSuccess: false,
  verifyEmailError: null,
  resetPasswordSuccess: false,
  resetPasswordConfirmationSuccess: false,
  resetPasswordError: null,
  updatePasswordSuccess: false,
  updatePasswordError: null,
  blockUserSuccess: false,
  blockUserError: null,
  unBlockUserSuccess: false,
  unBlockUserError: null,
  blockedUsersData: null,
  blockedUsersError: null,
  archiveRoomSuccess: false,
  archiveRoomError: null,
  unArchiveRoomSuccess: false,
  unArchiveRoomError: null,
  registerValidationError: null,
  loginValidationError: null,
  unauthorizedError: null,
  presenceError: null,
  profileError: null,
  editProfileError: null,
  accountDetailError: null,
  isLoadingDeleteAccount: false,
  deleteAccountError: null,
  newBadges: null,
  newRoles: null,
  syncDiscordError: null,
};

const authReducer = createReducer(
  initialState,

  // Login Actions
  on(
    loginAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      loginValidationError: null,
    })
  ),
  on(
    loginSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      isLoggedIn: true,
      account: action.payload,
    })
  ),
  on(
    loginFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      loginValidationError: action.error,
    })
  ),

  // Register Actions
  on(
    registerAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      registerValidationError: null,
    })
  ),
  on(
    registerSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      isLoggedIn: true,
      account: action.payload,
    })
  ),
  on(
    registerFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      registerValidationError: action.error,
    })
  ),

  // Complete Registration Actions
  on(
    completeRegistrationAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      registerValidationError: null,
    })
  ),
  on(
    completeRegistrationSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      currentUser: action.payload,
    })
  ),
  on(
    completeRegistrationFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      registerValidationError: action.error,
    })
  ),

  // Selected Language Actions
  on(
    selectLanguagesAction,
    (state, action): AuthStateInterface => ({
      ...state,
      selectedLanguages: action.request,
    })
  ),
  on(
    languageSelectionAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      registerValidationError: null,
      isCompletedLanguage: false,
    })
  ),
  on(
    languageSelectionSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      isCompletedLanguage: true,
    })
  ),
  on(
    languageSelectionFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      registerValidationError: action.error,
    })
  ),
  on(
    updateLanguageArrayAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      registerValidationError: null,
    })
  ),
  on(
    updateLanguageArraySuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      currentUser: action.payload,
    })
  ),
  on(
    updateLanguageArrayFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      registerValidationError: action.error,
    })
  ),

  // isLoggedIn Actions
  on(
    isLoggedInAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      unauthorizedError: null,
    })
  ),
  on(
    isLoggedInSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      isLoggedIn: true,
      isCompletedRegistration: true,
      isCompletedLanguage: true,
      account: action.payload?.account,
      // TODO: No need here to fill currentUser
      currentUser: action.payload?.currentUser,
    })
  ),
  on(
    isLoggedInSuccessCompleteRegistrationAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      isLoggedIn: true,
      isCompletedRegistration: false,
      account: action.payload?.account,
      currentUser: action.payload?.currentUser,
      unauthorizedError: action.error,
    })
  ),
  on(
    isLoggedInSuccessLanguageSelectionAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      isLoggedIn: true,
      isCompletedRegistration: true,
      isCompletedLanguage: false,
      account: action.payload?.account,
      currentUser: action.payload?.currentUser,
      unauthorizedError: action.error,
    })
  ),
  on(
    isLoggedInFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      isLoggedIn: false,
      unauthorizedError: action.error,
    })
  ),

  // Get User Actions
  on(
    getCurrentUserAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
    })
  ),
  on(
    getCurrentUserSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      currentUser: action.payload,
    })
  ),
  on(
    getCurrentUserFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      profileError: action.error,
    })
  ),

  // Update User Actions
  on(
    updateCurrentUserAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
    })
  ),
  on(
    updateCurrentUserSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      currentUser: action.payload,
    })
  ),
  on(
    updateCurrentUserFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      editProfileError: action.error,
    })
  ),

  // Create Language Actions
  on(
    createLanguageAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
    })
  ),
  on(
    createLanguageSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      currentUser: action.payload,
    })
  ),
  on(
    createLanguageFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      editProfileError: action.error,
    })
  ),

  // Update Language Actions
  on(
    updateLanguageAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
    })
  ),
  on(updateLanguageSuccessAction, (state, action): AuthStateInterface => {
    const updatedLanguages = state.currentUser.languages.map((language) =>
      language.$id === action.payload.$id ? action.payload : language
    );

    return {
      ...state,
      isLoading: false,
      currentUser: {
        ...state.currentUser,
        languages: updatedLanguages,
      },
    };
  }),
  on(
    updateLanguageFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      editProfileError: action.error,
    })
  ),

  // Delete Language Actions
  on(
    deleteLanguageAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
    })
  ),
  on(
    deleteLanguageSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      currentUser: action.payload,
    })
  ),
  on(
    deleteLanguageFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      editProfileError: action.error,
    })
  ),

  // Bucket Actions
  on(
    uploadProfilePictureAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
    })
  ),
  on(
    uploadProfilePictureSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      currentUser: {
        ...state.currentUser,
        profilePic: action.payload.profilePic,
      },
    })
  ),
  on(
    uploadProfilePictureFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      editProfileError: action.error,
    })
  ),

  on(
    uploadOtherPhotosAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
    })
  ),
  on(
    uploadOtherPhotosSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      currentUser: {
        ...state.currentUser,
        otherPics: action.payload.otherPics,
      },
    })
  ),
  on(
    uploadOtherPhotosFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      editProfileError: action.error,
    })
  ),

  // Total Unseen Messages Reducer
  on(
    totalUnseenMessagesSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      currentUser: {
        ...state.currentUser,
        totalUnseen: action.payload.totalUnseen,
        totalUnseenArchived: action.payload.totalUnseenArchived,
      },
    })
  ),

  // Update Presence Actions
  on(
    updatePresenceSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      currentUser: action.payload,
    })
  ),
  on(
    updatePresenceFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      presenceError: action.error,
    })
  ),

  // Verify Email Actions
  on(
    verifyEmailAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      verifyEmailSuccess: false,
    })
  ),
  on(
    verifyEmailSuccessAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: false,
      verifyEmailSuccess: true,
    })
  ),
  on(
    verifyEmailFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      verifyEmailError: action.error,
    })
  ),

  // Verify Email Confirmation Actions
  on(
    verifyEmailConfirmationAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      verifyEmailConfirmationSuccess: false,
    })
  ),
  on(
    verifyEmailConfirmationSuccessAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: false,
      verifyEmailConfirmationSuccess: true,
      currentUser: {
        ...state.currentUser,
        verified: true,
      },
    })
  ),
  on(
    verifyEmailConfirmationFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      verifyEmailError: action.error,
    })
  ),

  // Reset Password Actions
  on(
    resetPasswordAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      resetPasswordSuccess: false,
    })
  ),

  on(
    resetPasswordSuccessAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: false,
      resetPasswordSuccess: true,
    })
  ),

  on(
    resetPasswordFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      resetPasswordError: action.error,
    })
  ),

  // Reset Password Confirmation Actions
  on(
    resetPasswordConfirmationAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      resetPasswordConfirmationSuccess: false,
    })
  ),
  on(
    resetPasswordConfirmationSuccessAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: false,
      resetPasswordConfirmationSuccess: true,
    })
  ),
  on(
    resetPasswordConfirmationFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      resetPasswordError: action.error,
    })
  ),

  // Update Password Actions
  on(
    updatePasswordAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      updatePasswordSuccess: false,
    })
  ),
  on(
    updatePasswordSuccessAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: false,
      updatePasswordSuccess: true,
    })
  ),
  on(
    updatePasswordFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      updatePasswordError: action.error,
    })
  ),
  on(
    updatePasswordResetValuesAction,
    (state): AuthStateInterface => ({
      ...state,
      updatePasswordSuccess: null,
      updatePasswordError: null,
    })
  ),

  // List Identities Actions
  on(
    listIdentitiesAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
    })
  ),
  on(
    listIdentitiesSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      identities: action.payload?.identities,
    })
  ),
  on(
    listIdentitiesFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      accountDetailError: action.error,
    })
  ),
  // Delete Identity Actions
  on(
    deleteIdentityAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
    })
  ),
  on(deleteIdentitySuccessAction, (state, action): AuthStateInterface => {
    const newIdentities = state.identities?.filter(
      (identity) => identity.$id !== action.payload.$id
    );
    return {
      ...state,
      isLoading: false,
      identities: newIdentities,
    };
  }),
  on(
    deleteIdentityFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      accountDetailError: action.error,
    })
  ),

  // List Sessions Actions
  on(
    listSessionsAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
    })
  ),
  on(
    listSessionsSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      sessions: action.payload?.sessions,
    })
  ),
  on(
    listSessionsFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      registerValidationError: action.error,
    })
  ),

  // Sync Discord Roles Actions
  on(
    syncDiscordRolesAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
    })
  ),
  on(syncDiscordRolesSuccessAction, (state, action): AuthStateInterface => {
    console.log(action.payload);
    return {
      ...state,
      isLoading: false,
      newBadges: action.payload?.newBadges || null,
      newRoles: action.payload?.newRoles || null,
    };
  }),
  on(syncDiscordRolesFailureAction, (state, action): AuthStateInterface => {
    console.log(action.error);
    return {
      ...state,
      isLoading: false,
      syncDiscordError: action.error,
    };
  }),

  // Delete Session Actions
  on(
    deleteSessionAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
    })
  ),
  on(deleteSessionSuccessAction, (state, action): AuthStateInterface => {
    const newSessions = state.sessions?.filter(
      (session) => session.$id !== action.payload.$id
    );
    return {
      ...state,
      isLoading: false,
      sessions: newSessions,
    };
  }),
  on(
    deleteSessionFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      deleteAccountError: action.error,
    })
  ),

  // Delete Account Actions
  on(
    deleteAccountAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoadingDeleteAccount: true,
    })
  ),
  on(
    deleteAccountSuccessAction,
    (state, action): AuthStateInterface => ({
      ...initialState,
    })
  ),
  on(
    deleteAccountFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoadingDeleteAccount: false,
      deleteAccountError: action.error,
    })
  ),

  // Block User Reducers
  on(
    blockUserAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      blockUserError: null,
    })
  ),
  on(
    blockUserSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      currentUser: action.payload,
      blockUserSuccess: true,
    })
  ),
  on(
    blockUserFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      blockUserError: action.error,
    })
  ),
  on(
    blockUserInitialStateAction,
    (state): AuthStateInterface => ({
      ...state,
      blockUserSuccess: false,
      blockUserError: null,
    })
  ),

  // Unblock User Reducers
  on(
    unBlockUserAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      unBlockUserError: null,
    })
  ),
  on(unBlockUserSuccessAction, (state, action): AuthStateInterface => {
    return {
      ...state,
      isLoading: false,
      currentUser: action.payload,
      unBlockUserSuccess: true,
      blockedUsersData: state.blockedUsersData?.filter((user) => {
        return action.payload.blockedUsers.includes(user.$id);
      }),
    };
  }),
  on(
    unBlockUserFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      unBlockUserError: action.error,
    })
  ),
  on(
    unBlockUserInitialStateAction,
    (state): AuthStateInterface => ({
      ...state,
      unBlockUserSuccess: false,
      unBlockUserError: null,
    })
  ),

  // Get Blocked Users Data Reducers
  on(
    getBlockedUsersAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      blockedUsersError: null,
    })
  ),
  on(
    getBlockedUsersSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      blockedUsersData: action.payload,
    })
  ),
  on(
    getBlockedUsersFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      blockedUsersError: action.error,
    })
  ),

  // Archive Room Actions
  on(
    archiveRoomAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      archiveRoomError: null,
    })
  ),
  on(
    archiveRoomSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      currentUser: action.payload,
      archiveRoomSuccess: true,
    })
  ),
  on(
    archiveRoomFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      archiveRoomError: action.error,
    })
  ),
  on(
    archiveRoomInitialStateAction,
    (state): AuthStateInterface => ({
      ...state,
      archiveRoomSuccess: false,
      archiveRoomError: null,
    })
  ),

  // UnArchive Room Actions
  on(
    unArchiveRoomAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
      unArchiveRoomError: null,
    })
  ),
  on(
    unArchiveRoomSuccessAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      currentUser: action.payload,
      unArchiveRoomSuccess: true,
    })
  ),
  on(
    unArchiveRoomFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      unArchiveRoomError: action.error,
    })
  ),
  on(
    unArchiveRoomInitialStateAction,
    (state): AuthStateInterface => ({
      ...state,
      unArchiveRoomSuccess: false,
      unArchiveRoomError: null,
    })
  ),

  // Logout Actions
  on(
    logoutAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: true,
    })
  ),
  on(
    logoutSuccessAction,
    (): AuthStateInterface => ({
      ...initialState,
    })
  ),
  on(
    logoutFailureAction,
    (state, action): AuthStateInterface => ({
      ...state,
      isLoading: false,
      unauthorizedError: action.error,
    })
  ),

  // Clear Errors Actions
  on(
    clearErrorsAction,
    (state): AuthStateInterface => ({
      ...state,
      isLoading: false,
      registerValidationError: null,
      loginValidationError: null,
      unauthorizedError: null,
      presenceError: null,
      profileError: null,
      editProfileError: null,
      accountDetailError: null,
      deleteAccountError: null,
      verifyEmailSuccess: false,
      resetPasswordSuccess: false,
      newBadges: null,
      newRoles: null,
      syncDiscordError: null,
    })
  )
);

export function authReducers(state: AuthStateInterface, action: Action) {
  return authReducer(state, action);
}
