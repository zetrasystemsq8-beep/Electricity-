// Static self-help content, ported verbatim from the original
// backend/src/services/supportService.ts SELF_HELP map (section 13 of the
// build brief). No network call needed for this - it never changes.
class SupportGuide {
  final String title;
  final List<String> steps;
  const SupportGuide(this.title, this.steps);
}

class SupportContent {
  static const Map<String, SupportGuide> _guides = {
    'CHECK_BALANCE': SupportGuide('How to check your balance', [
      "Go to your meter's keypad (the CIU).",
      "Enter your DISCO's balance-check code (see your meter's guide in the app for the exact code).",
      'Press Enter.',
      'Your remaining units will appear on the small screen.',
    ]),
    'LOAD_TOKEN': SupportGuide('How to load your token', [
      'Open My Tokens in the app and copy the 20-digit token.',
      "On your meter's keypad, enter the token exactly as shown, including all digits.",
      'Press Enter.',
      'Wait for the confirmation message or beep.',
      'Check your new balance to confirm it loaded.',
    ]),
    'TOKEN_NOT_WORKING': SupportGuide("My token isn't working", [
      'Re-enter the token carefully - a single wrong digit will reject it.',
      'Confirm the token was generated for this exact meter number.',
      'Some meters reject a token entered too many times incorrectly and need a short wait before retrying.',
      "If it still fails, raise a Token Problem ticket from Support and include the transaction reference.",
    ]),
    'METER_ERROR': SupportGuide('My meter shows an error', [
      'Note the exact error code or message shown on the meter display.',
      'Check that you are not mid-way through entering a token or code.',
      "Consult your meter's guide in the app for that specific error code, if listed.",
      'If unresolved, raise a Meter Problem ticket and include the error shown.',
    ]),
    'ELECTRICITY_FINISHED': SupportGuide('My electricity finished', [
      "Confirm the balance is actually zero on the meter display, not just low in the app's estimate.",
      'Buy electricity from the Buy tab.',
      'Load the new token as soon as it\'s generated.',
    ]),
    'NO_TOKEN_RECEIVED': SupportGuide("I bought electricity but didn't receive a token", [
      'Open History and check the transaction status.',
      'If it shows Pending, wait a few minutes - the provider may still be confirming.',
      'If it shows Successful but no token appears, raise a Token Problem ticket with the transaction reference - do not repurchase.',
      'If it shows Failed and you were charged, raise a Payment Problem ticket for a refund.',
    ]),
    'DEDUCTION_UNCLEAR': SupportGuide("I don't understand my deduction", [
      'Open the transaction in History to see the exact breakdown returned by the provider.',
      "Any amount the app can't attribute to electricity value is shown as the provider's reported charge, never guessed.",
      'If something still looks wrong, raise a ticket under Balance Problem with the transaction reference.',
    ]),
    'METER_NOT_CONNECTING': SupportGuide("My meter isn't connecting", [
      'This app does not directly connect to your physical meter unless a live-data integration is available for your DISCO.',
      "Check whether your meter shows 'Live meter balance' or 'Estimated' on the Home screen - only Live means a direct connection exists.",
      'For estimated meters, enter your current reading manually to refresh your estimate.',
    ]),
  };

  static List<Map<String, dynamic>> topics() =>
      _guides.entries.map((e) => {'key': e.key, 'title': e.value.title}).toList();

  static Map<String, dynamic> guide(String key) {
    final g = _guides[key];
    if (g == null) throw Exception('No self-help guide found for that topic.');
    return {'title': g.title, 'steps': g.steps};
  }
}
