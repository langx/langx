# DRAFT — Terms §6–§7 change for sticker pack gifts

> **Draft for Behic. Not published, not legal advice, and nothing in the app
> reads it.** Publishing legal text is Behic's decision. This file exists so
> the wording can be reviewed beside the code that would make it necessary;
> it should be deleted, or moved into the website's Terms, once he has
> decided.

`flags.stickerGifts` (off by default) lets a person spend their own tokens on
a sticker pack for a chat partner. With the switch on, today's Terms §7 says
something the app no longer does — virtual items "are not transferable" — and
§6's "cannot be transferred to another user" stays true by its letter while a
reader would reasonably take it to cover this. **Switch the flag on only after
the Terms below (or Behic's version of them) are live** on the website, in the
GitBook docs and on the token website, which carry copies by hand (see
`docs/repo-map.md`).

The Terms live in the sibling repo at
`website/src/lib/components/organisms/TermsAndConditions.md`.

## §7 Virtual Items — today

> Tokens may be spent on virtual items: a streak freeze, and cosmetic profile
> frames and titles. Virtual items are licensed to you for use within the App,
> are not transferable, have no cash value, and are not refundable. Unspent
> tokens and any virtual items you hold are forfeited when your account is
> deleted.

(Already a little behind the app: it does not name sticker packs or the
missed-day repair. The draft below names both.)

## §7 Virtual Items — proposed

> Tokens may be spent on virtual items: a streak freeze, a missed-day repair,
> and cosmetic items — profile frames, titles and sticker packs. Virtual items
> are licensed to you for use within the App, have no cash value, and are not
> refundable. Except as described in the next paragraph, they are not
> transferable. Unspent tokens and any virtual items you hold are forfeited
> when your account is deleted.
>
> **Gifts.** Where the App offers it, you may spend your own tokens on a
> sticker pack for another user, within the limits shown in the App. A gifted
> item belongs to the person who received it; it cannot be passed on,
> returned, exchanged or refunded, and the tokens spent on it are not
> returned. Gifting may be limited, paused or withdrawn at any time, and is
> not available to or from users under 18.

## §6 LangX Token — proposed addition

The bullet stays as it is; one sentence after the list makes the relation to
§7 explicit, so nobody has to infer it:

> - It cannot be transferred to another user.
>
> Spending your own tokens on a gift for another user (section 7) does not
> transfer tokens: the other user's balance does not change.

## The one line in the app

The confirmation step already says the same thing, in all eight languages
(`stickerGift.honesty`):

> The pack becomes theirs. A gift cannot be returned, passed on or refunded,
> and the tokens are not given back.

If Behic changes the Terms wording, that line should be changed to match.

## Also to check before the switch goes on

- The GitBook docs and the token website repeat the "cannot be transferred"
  bullet; both need the same sentence.
- App Review notes: one sentence — "Gifts are bought with earned in-app points
  that cannot be purchased." The research found nothing in Apple 3.1.1 or the
  Google Play payments policy against this while tokens cannot be bought;
  if tokens or items are ever sold for money, gifting falls under in-app
  purchase rules.
- `docs/decisions.md` → _A sticker pack can be given to a chat partner, behind
  a switch_ records what the switch changes.
