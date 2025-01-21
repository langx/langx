import { Models } from 'react-native-appwrite';
import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';

interface RegisterState {
  birthdate: string;
  gender: string;
  country: string;
  countryCode: string;
  motherLanguageName: string;
  motherLanguageCode: string;
  motherLanguageNativeName: string;
  isLoading: boolean;
  error: string | null;
}

const initialState: RegisterState = {
  birthdate: null,
  gender: null,
  country: null,
  countryCode: null,
  motherLanguageName: null,
  motherLanguageCode: null,
  motherLanguageNativeName: null,
  isLoading: false,
  error: null,
};

// export const fetchAuthData = createAsyncThunk(
//   'auth/fetchAuthData',
//   async (_, { dispatch }) => {
//     try {
//       const [account, user, session, jwt]: [
//         Account,
//         User,
//         Session,
//         Models.Jwt
//       ] = await Promise.all([
//         getAccount(),
//         getCurrentUser(),
//         getCurrentSession(),
//         createJWT(),
//       ]);

//       if (account) {
//         dispatch(setAccount(account));
//       }
//       if (user) {
//         dispatch(setUser(user));
//       }
//       if (session) {
//         dispatch(setSession(session));
//       }
//       if (jwt) {
//         dispatch(setJwt(jwt));
//       }
//     } catch (error) {
//       console.error(error);
//       dispatch(setError((error as Error).message || 'An error occurred'));
//       dispatch(setUser(null));
//     }
//   }
// );

const registerSlice = createSlice({
  name: 'register',
  initialState,
  reducers: {
    setBirthdate: (state, action: PayloadAction<string | null>) => {
      state.birthdate = action.payload;
    },
    setGender: (state, action: PayloadAction<string | null>) => {
      state.gender = action.payload;
    },
    setCountry: (state, action: PayloadAction<string | null>) => {
      state.country = action.payload;
    },
    setCountryCode: (state, action: PayloadAction<string | null>) => {
      state.countryCode = action.payload;
    },
    setMotherLanguageName: (state, action: PayloadAction<string | null>) => {
      state.motherLanguageName = action.payload;
    },
    setMotherLanguageCode: (state, action: PayloadAction<string | null>) => {
      state.motherLanguageCode = action.payload;
    },
    setMotherLanguageNativeName: (
      state,
      action: PayloadAction<string | null>
    ) => {
      state.motherLanguageNativeName = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setRegisterInitialState: (state) => {
      Object.assign(state, initialState);
      state.isLoading = false;
    },
  },
  // extraReducers: (builder) => {
  //   builder
  //     .addCase(fetchAuthData.pending, (state) => {
  //       state.isLoading = true;
  //     })
  //     .addCase(fetchAuthData.fulfilled, (state) => {
  //       state.isLoading = false;
  //     })
  //     .addCase(fetchAuthData.rejected, (state, action) => {
  //       state.isLoading = false;
  //       state.error = action.error.message || 'An error occurred';
  //     });
  // },
});

export const {
  setBirthdate,
  setGender,
  setCountry,
  setCountryCode,
  setMotherLanguageName,
  setMotherLanguageCode,
  setMotherLanguageNativeName,
  setLoading,
  setError,
  setRegisterInitialState,
} = registerSlice.actions;

export default registerSlice.reducer;
