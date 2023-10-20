import { throwIfMissing, sendPushNotification } from './utils.js';

// Test Data with 11 Pro Simulator
// {"deviceToken":"egEjInzQzEwcr4sAsf5bAs:APA91bFHrqkhyx36bkQDlHPgKgtfEP2G0g4jkw9EXWKwhg8f6dah_4_Caz1etlkt_25M4BGQWeMKWihRrB31-aWEq7u1vvENZoZZHSyEqItZ2karOhf_utTnD7YKIBqng1-rBQVN9oYb", "message":"Hello World"}

export default async ({ req, res, log, error }) => {
  try {
    log(req);
    log(req.body);
    throwIfMissing(req.body, ['deviceToken', 'message']);
    // throwIfMissing(req.body.message, ['title', 'body']);
  } catch (err) {
    return res.json({ ok: false, error: err.message }, 400);
  }

  log(`Sending message to device: ${req.body.deviceToken}`);

  try {
    const response = await sendPushNotification({
      notification: {
        // title: req.body.message.title,
        // body: req.body.message.body,
        title: 'languageXchange',
        body: req.body.message,
      },
      data: {
        detailsId: '33',
      },
      token: req.body.deviceToken,
    });
    log(`Successfully sent message: ${response}`);

    return res.json({ ok: true, messageId: response });
  } catch (e) {
    error(e);
    return res.json({ ok: false, error: 'Failed to send the message' }, 500);
  }
};
