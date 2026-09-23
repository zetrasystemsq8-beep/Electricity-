# PowerPal — Flutter app

This is the Flutter client for PowerPal. It talks to the exact same
backend as the web build (`../backend`) — nothing on the server changed
except that `/purchases/initiate` now also returns a real Paystack
`checkoutUrl` for the in-app webview checkout (see
`../backend/src/routes/purchase.routes.ts`).

## 1. Bring in your Android/iOS shell from naijalearn

This repo does **not** ship its own `android/`/`ios/` folders — you're
supplying those from your existing naijalearn Flutter project, renamed.
In Termux, from wherever `naijalearn` and this project both live:

```bash
# copy the platform shells across
cp -r ~/naijalearn/android ~/Electricity-App/flutter_app/android
cp -r ~/naijalearn/ios ~/Electricity-App/flutter_app/ios

cd ~/Electricity-App/flutter_app

# rename the Kotlin package folder + file
mkdir -p android/app/src/main/kotlin/com/powerpal/app
mv android/app/src/main/kotlin/com/naijalearn/app/MainActivity.kt \
   android/app/src/main/kotlin/com/powerpal/app/
rmdir android/app/src/main/kotlin/com/naijalearn/app
rmdir android/app/src/main/kotlin/com/naijalearn

# fix the package declaration inside the file
sed -i 's/com\.naijalearn\.app/com.powerpal.app/' \
   android/app/src/main/kotlin/com/powerpal/app/MainActivity.kt

# fix applicationId/namespace
sed -i 's/com\.naijalearn\.app/com.powerpal.app/' android/app/build.gradle.kts

# fix the visible app name
grep -n "android:label" android/app/src/main/AndroidManifest.xml
# then edit that line by hand to "PowerPal" (or whatever name you land on):
#   sed -i 's/android:label="[^"]*"/android:label="PowerPal"/' android/app/src/main/AndroidManifest.xml
```

Swap `powerpal`/`com.powerpal.app` for your real final package name and
app name everywhere above before you run it for real — pick this once,
since changing a package ID after publishing to the Play Store is painful.

## 2. Point the app at your backend

`lib/api/api_client.dart` reads the backend URL from a compile-time
constant, `API_BASE_URL`, defaulting to `http://10.0.2.2:4000/api` (the
special address an Android emulator uses to reach `localhost` on the host
machine). Building for a real phone, pass your machine's LAN IP or your
deployed backend's URL:

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.1.42:4000/api
```

or bake it into a release build:

```bash
flutter build apk --dart-define=API_BASE_URL=https://your-deployed-backend.com/api
```

## 3. Paystack checkout

Payment now goes through Paystack's hosted checkout (real
`transaction/initialize` call on the backend), opened in-app via
`webview_flutter` (`lib/screens/payment_webview_screen.dart`). Make sure
`PAYSTACK_SECRET_KEY` is set in `backend/.env`, and that the
`callback_url` the backend sends (`https://powerpal.app/payment-callback`
in `purchase.routes.ts`) matches what you use consistently — the webview
intercepts any navigation starting with that prefix, pulls the
`reference`/`trxref` param out of it, and closes itself.

## 4. Run it

```bash
cd flutter_app
flutter pub get
flutter run --dart-define=API_BASE_URL=http://<your-backend-ip>:4000/api
```

## What's implemented

Every screen from the web build has a Flutter equivalent: Welcome,
Register, Login, Add/Verify Meter, Home dashboard, Buy → Confirm → Paystack
webview → success/token screen, Token Vault, History → Receipt, Usage
(with meter-reading input), Meter Guide, Support (self-help + tickets),
Budget, Profile, and the Admin dashboard (Overview, Users, Transactions,
Support). Same rule as the backend: nothing here fakes data — every screen
calls the real API and shows real loading/error states.
