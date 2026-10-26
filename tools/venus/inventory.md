# Venus: item inventory

Generated from `data/items.json` by `node items-build.mjs --doc`. Do not edit by hand: the registry is the
source, and `test/items.test.mjs` fails if this file drifts from it.

**73 items** in 6 categories: 25 P0 (needed for the first mass render), 26 P1, 22 P2 (catalogued, not drawn). 49 are drawn in `lib/items-art.mjs`; the two outfits are drawn by the rig.

| Category | Items | P0 | P1 | P2 |
|---|---|---|---|---|
| Thrones and seats | 12 | 5 | 1 | 6 |
| Toys and visitors | 10 | 4 | 2 | 4 |
| Food and treats | 16 | 2 | 14 | 0 |
| Outfits and accessories | 16 | 7 | 5 | 4 |
| Language-learning props | 9 | 4 | 1 | 4 |
| Milestone and seasonal props | 10 | 3 | 3 | 4 |

## How items enter a video

- **One hero item a day, at most.** A throne day is about the throne; milestones may carry their set (up to a seat plus two).
- **Rest days.** About 30 % of ordinary days carry no item, so items stay a treat.
- **Never the same item two days running**, and each item has a cooldown in days before it may return (a quip that calls for it overrides the cooldown, never the two-days rule).
- **Milestone-only items** (crown, party hat, trophy, cake, confetti cannon, medal, gift, balloon) appear on milestones only.
- **Bag lines get a bag.** A quip that names a bag always gets a bag (paper-bag or kraft-bag) when the plan has a seat; two bag days in a row alternate the two bags.
- **The throne** appears exactly when the score builds it (the `bag-throne` move or the `bag-hop` entrance). It replaces the rig's old yellow plastic bag.
- **Seasonal items** are catalogued but never picked: the shared streak video is keyed by streak day and cannot know the date.
- **Placement.** Floor props stand at x ±228 rig units (or their own propX). Props that carry glyphs always stand screen-left, out of the Reels right rail. A sprawl puts her body screen-left, so props go right; the feather wand hangs screen-left, where her raised paw reaches.

## Milestone sets

| Day | Items |
|---|---|
| 1 | Polka-dot bow, Speech-bubble sign |
| 3 | Flashcards |
| 7 | Sunglasses, Cardboard box |
| 10 | Red snowflake hoodie |
| 14 | Throne cushion |
| 21 | Reading glasses, Tiny dictionary |
| 30 | Party hat, Confetti cannon |
| 50 | Crown, Balloon |
| 100 | Trophy, Bow tie |
| 200 | Rosette medal, Cake with one candle |
| 365 | Crown, Gift box |

## Interactions

| Interaction | What it looks like | Implemented |
|---|---|---|
| `sits-in` | She sits inside it; its front wall is drawn over her lower body (occlusion), the seat has its own contact shadow, and it pops up under her on the bag beat (the score's `bag` track). | yes |
| `sits-on` | She sits on top of it: lifted by the seat's height, paws sinking into its front edge. | yes |
| `wears-head` | Worn on the head, in the rig's head space: it follows head roll, pitch and yaw. | yes |
| `wears-face` | Worn on the face (eye line or forehead), squashed per side with the head's yaw like her eyes. | yes |
| `wears-neck` | Worn at the neck, between body and head so her chin overlaps it. | yes |
| `beside` | Stands on the floor beside her with a contact shadow; on milestones it pops in at the number. | yes |
| `guards` | Beside her; on the last sentence her eyes slide to it (the treat guard of photo 10). | yes |
| `watches` | Beside her; her eyes go to it during the reaction beat. | yes |
| `rolls-in` | Rolls in from off-frame during the entrance, rotation matching distance, and stops at her side; she watches it. | yes |
| `dangles-bats` | Dangles from off-frame top on a string, swinging; her eyes track it and she pats at it twice with her raised paw after the number. | yes |
| `chases-dot` | A red dot wanders over the wall behind her from the reaction on; her eyes follow it. | yes |
| `flutters` | Flies in on the punchline sentence in a figure-eight by her head; her eyes follow it. | yes |
| `pops` | Fires at the number: a kick, a pop, streamers and paper bits from its mouth. | yes |
| `floats` | Tied to a little weight on the floor, bobbing high in frame, visible over the caption. | yes |
| `ignores` | Beside her and pointedly not looked at: during the reaction her eyes go up and away from it, chin high; on the last sentence one sneaky glance back at it. | yes |
| `rig-outfit` | Already in the rig (`outfit`), changed under the outfit poof. | yes |

## Thrones and seats

### Cardboard box `cardboard-box` · P0

- **Why it's funny or lovable:** If it fits, she sits: the most universal cat truth there is, and a throne made of trash suits a diva whose act keeps collapsing.
- **Gag / beat:** Bag-hop entrance or bag-throne move on a line that does not name a bag: the box pops up as she lands, flaps splayed like a royal canopy. (gags: the-bag; formula A, B)
- **Days:** milestones 7; ordinary days, any mood. Cooldown 3 days.
- **Rig interaction:** `sits-in`.
- **Art:** `assets/items/cardboard-box.svg` (`cardboard-box` in items-art.mjs). **Locale:** Text-free; the arrows are an icon, not words.

### Paper bag (yellow) `paper-bag` · P0

- **Why it's funny or lovable:** The bag throne of photos 15 and 16, redrawn as a crisp brand-yellow shopping bag: a handle flopped forward over the front, the other rising behind her like a canopy.
- **Gag / beat:** Every line that names a bag. The punchline is the bag; she is the queen of it. (gags: the-bag; formula A, E)
- **Days:** ordinary days, any mood; lines: reg-03, reg-13, ro-09, ro-11, ro-14, ro-18, pr-11, ms-3-b, ms-10-b, ms-30-b, ms-365-b, cb-01. Cooldown 1 days.
- **Rig interaction:** `sits-in`.
- **Art:** `assets/items/paper-bag.svg` (`paper-bag` in items-art.mjs). **Locale:** Print is a speech bubble with three dots; no letters, no shop marks.

### Paper bag (kraft) `kraft-bag` · P1

- **Why it's funny or lovable:** The same throne in brown paper, so two bag days in a row never show the same bag ('I found a new bag today').
- **Gag / beat:** Bag lines on the day after a yellow bag; also the bag on the yellow 'stripes' ground. (gags: the-bag; formula A, E)
- **Days:** ordinary days, any mood; lines: reg-03, reg-13, ro-09, ro-11, ro-14, ro-18, pr-11, ms-3-b, ms-10-b, ms-30-b, ms-365-b, cb-01. Cooldown 1 days.
- **Rig interaction:** `sits-in`.
- **Art:** `assets/items/kraft-bag.svg` (`paper-bag` in items-art.mjs). **Locale:** Text-free.

### Laundry basket `laundry-basket` · P0

- **Why it's funny or lovable:** Clean laundry is a cat magnet; the striped sock over the rim says she has been in it all day.
- **Gag / beat:** Bag-hop entrance on a non-bag line; reads as 'found a better throne'. (gags: the-bag; formula A)
- **Days:** ordinary days, any mood. Cooldown 3 days.
- **Rig interaction:** `sits-in`.
- **Art:** `assets/items/laundry-basket.svg` (`laundry-basket` in items-art.mjs). **Locale:** Text-free.

### Throne cushion `cushion` · P0

- **Why it's funny or lovable:** The one real throne she owns: velvet, gold piping, tassels. Day 14 she naps on it, which undoes the whole regal effect.
- **Gag / beat:** Day 14 (naps): already under her when she wakes. Otherwise a seat on bag-hop days. (gags: the-bag, the-wardrobe; formula B, D)
- **Days:** milestones 14; ordinary days, any mood; lines: ms-14-a. Cooldown 3 days.
- **Rig interaction:** `sits-on`.
- **Art:** `assets/items/cushion.svg` (`cushion` in items-art.mjs). **Locale:** Text-free.

### Open suitcase `suitcase` · P0

- **Why it's funny or lovable:** Every cat claims the suitcase. For a language app it is the trip you are learning for, and she has packed herself.
- **Gag / beat:** Bag-hop entrance on a non-bag line. The lid stands behind her like a throne back, travel stickers on its lining. (gags: the-bag, the-planet; formula A, E)
- **Days:** ordinary days, any mood. Cooldown 3 days.
- **Rig interaction:** `sits-in`.
- **Art:** `assets/items/suitcase.svg` (`suitcase` in items-art.mjs). **Locale:** One sticker shows 'Aa'; Latin letters read as 'alphabet' in every locale.

### Warm keyboard `keyboard` · P2

- **Why it's funny or lovable:** She sits on the keyboard exactly when you want to study. A poke at the habit that hurts nobody.
- **Gag / beat:** Habit tease: 'You study. I sit on it.' (gags: the-counter; formula E)
- **Days:** not in the grammar yet. Cooldown 5 days.
- **Rig interaction:** `sits-on`.
- **Art:** not drawn yet. **Locale:** Keys blank: a keyboard layout is locale-specific.

### A box far too small `too-small-box` · P2

- **Why it's funny or lovable:** If it almost fits, she still sits. Pure formula A.
- **Gag / beat:** She sits in a tissue-box-sized box; only half of her is in it; 'Perfect fit.' (gags: the-bag; formula A)
- **Days:** not in the grammar yet. Cooldown 7 days.
- **Rig interaction:** `sits-in` — needs a new rig move: squeeze: haunches overflowing a seat narrower than her.
- **Art:** not drawn yet. **Locale:** Text-free.

### Fruit bowl `fruit-bowl` · P2

- **Why it's funny or lovable:** A cat curled in the fruit bowl is a classic 'this is so my cat'.
- **Gag / beat:** Counter days: she is the fruit now. (gags: the-counter; formula A, E)
- **Days:** not in the grammar yet. Cooldown 7 days.
- **Rig interaction:** `sits-in`.
- **Art:** not drawn yet. **Locale:** Text-free.

### Pizza box `pizza-box` · P2

- **Why it's funny or lovable:** Warm, flat, smells of cheese: a throne by cat logic.
- **Gag / beat:** Regular days, 'could involve snacks' pokes. (gags: the-bag; formula E)
- **Days:** not in the grammar yet. Cooldown 7 days.
- **Rig interaction:** `sits-on`.
- **Art:** not drawn yet. **Locale:** No brand, no text.

### Donut cat bed (ignored) `cat-bed` · P2

- **Why it's funny or lovable:** The expensive bed she never uses, sitting empty beside her while she sits in its box.
- **Gag / beat:** Paired with the cardboard box. (gags: the-bag; formula A)
- **Days:** not in the grammar yet. Cooldown 7 days.
- **Rig interaction:** `beside`.
- **Art:** not drawn yet. **Locale:** Text-free.

### Open drawer `open-drawer` · P2

- **Why it's funny or lovable:** Any open drawer is hers within seconds.
- **Gag / beat:** Peek entrance out of a drawer. (gags: the-counter; formula E)
- **Days:** not in the grammar yet. Cooldown 7 days.
- **Rig interaction:** `sits-in` — needs a new rig move: a set piece: furniture edge at frame bottom.
- **Art:** not drawn yet. **Locale:** Text-free.

## Toys and visitors

### Feather wand `feather-wand` · P0

- **Why it's funny or lovable:** Hunter mode (photo 17). Her dignity lasts exactly until the feathers move.
- **Gag / beat:** Formula C: the speech starts, the feathers swing, her eyes go with them, she pats twice, then pretends nothing happened. (gags: hunter-mode; formula C)
- **Days:** ordinary days, moods: goof, curious; lines: reg-07. Cooldown 6 days.
- **Rig interaction:** `dangles-bats` — needs a new rig move: a sideways left-paw swat (today she pats with the right paw lift).
- **Art:** `assets/items/feather-wand.svg` (`feather-wand` in items-art.mjs). **Locale:** Text-free.

### The red dot `red-dot` · P0

- **Why it's funny or lovable:** Her one love she never catches (§5, once a month). It works with the sound off: everyone knows the dot.
- **Gag / beat:** The dot crosses the wall behind her during the reaction; her eyes snap to it mid-verdict. (gags: the-red-dot; formula C)
- **Days:** ordinary days, moods: goof, curious, smug. Cooldown 30 days.
- **Rig interaction:** `chases-dot` — needs a new rig move: hunt-wiggle (bible §9.2 #2) for the full stalk and pounce.
- **Art:** `assets/items/red-dot.svg` (`red-dot` in items-art.mjs). **Locale:** Text-free.

### Ball of yarn `yarn-ball` · P0

- **Why it's funny or lovable:** The picture-book cat toy, with the needles still in it: somebody's knitting is ruined and she is proud.
- **Gag / beat:** Rolls in on the entrance and stops at her side; she watches it go by instead of the number. (gags: hunter-mode; formula C)
- **Days:** ordinary days, moods: goof, soft. Cooldown 6 days.
- **Rig interaction:** `rolls-in`.
- **Art:** `assets/items/yarn-ball.svg` (`yarn-ball` in items-art.mjs). **Locale:** Text-free.

### Wind-up toy mouse `toy-mouse` · P0

- **Why it's funny or lovable:** Her 'prey', key still turning. She keeps an eye on it like it might report her.
- **Gag / beat:** Sits beside her; her eyes flick to it during the reaction, then back to you. (gags: hunter-mode; formula B, C)
- **Days:** ordinary days, moods: goof, curious, smug. Cooldown 6 days.
- **Rig interaction:** `watches`.
- **Art:** `assets/items/toy-mouse.svg` (`toy-mouse` in items-art.mjs). **Locale:** Text-free.

### Catnip fish `catnip-fish` · P1

- **Why it's funny or lovable:** The plush she would never admit she sleeps with.
- **Gag / beat:** Soft and cosy days, beside her loaf. (gags: hunter-mode; formula D)
- **Days:** ordinary days, moods: soft, goof, sleepy. Cooldown 6 days.
- **Rig interaction:** `beside`.
- **Art:** `assets/items/catnip-fish.svg` (`catnip-fish` in items-art.mjs). **Locale:** Text-free.

### The moth `moth` · P1

- **Why it's funny or lovable:** A visitor, not a toy: the thing that wipes out her verdict in ro-12.
- **Gag / beat:** Flies in exactly on '…Ooh, a moth.' and loops round her head; her eyes follow it. (gags: hunter-mode; formula C)
- **Days:** only when its line plays; lines: ro-12. Cooldown 14 days.
- **Rig interaction:** `flutters`.
- **Art:** `assets/items/moth.svg` (`moth` in items-art.mjs). **Locale:** Text-free.

### Crinkle ball `crinkle-ball` · P2

- **Why it's funny or lovable:** Noisy and shiny; a sound gag (crinkle SFX exists).
- **Gag / beat:** Rolls in on a crinkle. (gags: hunter-mode; formula C)
- **Days:** not in the grammar yet. Cooldown 6 days.
- **Rig interaction:** `rolls-in`.
- **Art:** not drawn yet. **Locale:** Text-free.

### Plastic spring `spring-toy` · P2

- **Why it's funny or lovable:** The cheapest toy, the most loved.
- **Gag / beat:** Bounces in on a boing. (gags: hunter-mode; formula C)
- **Days:** not in the grammar yet. Cooldown 6 days.
- **Rig interaction:** `beside`.
- **Art:** not drawn yet. **Locale:** Text-free.

### Bottle cap `bottle-cap` · P2

- **Why it's funny or lovable:** A thing to knock off a ledge in your honour.
- **Gag / beat:** Knock-off: she taps it off, looks at you. (gags: knocked-off-things; formula E)
- **Days:** not in the grammar yet; lines: reg-12. Cooldown 14 days.
- **Rig interaction:** `beside` — needs a new rig move: knock-off (bible §9.2 #3).
- **Art:** not drawn yet. **Locale:** Text-free.

### Stolen hair tie `hair-tie` · P2

- **Why it's funny or lovable:** Every cat owner's missing hair ties are under this cat.
- **Gag / beat:** She sits on a pile of them. (gags: knocked-off-things; formula E)
- **Days:** not in the grammar yet. Cooldown 14 days.
- **Rig interaction:** `beside`.
- **Art:** not drawn yet. **Locale:** Text-free.

## Food and treats

### Treat pouch `treat-pouch` · P0

- **Why it's funny or lovable:** Photo 10: she stands guard over two treat packets. Every 'could involve snacks' poke comes back to this.
- **Gag / beat:** ro-06: on '…Could involve snacks' her eyes slide to the pouch. Other days it is simply hers. (gags: treat-guard; formula E)
- **Days:** ordinary days, moods: smug, soft; lines: ro-06. Cooldown 6 days.
- **Rig interaction:** `guards`.
- **Art:** `assets/items/treat-pouch.svg` (`treat-pouch` in items-art.mjs). **Locale:** Text-free: a fish emblem and a window of treats.

### Food bowl `food-bowl` · P0

- **Why it's funny or lovable:** A full bowl and a cat acting like it is empty: relatable to every owner.
- **Gag / beat:** Cosy days; the slow blink over a full bowl. (gags: treat-guard; formula E)
- **Days:** ordinary days, moods: soft, sleepy, goof; lines: nw-09. Cooldown 6 days.
- **Rig interaction:** `beside`.
- **Art:** `assets/items/food-bowl.svg` (`food-bowl` in items-art.mjs). **Locale:** Text-free; a paw print, not a name.

### A whole fish `fish` · P1

- **Why it's funny or lovable:** Where did she get it? Nobody asks. She glances at it like a co-conspirator.
- **Gag / beat:** Watched during the reaction beat. (gags: treat-guard; formula C)
- **Days:** ordinary days, moods: curious, goof. Cooldown 8 days.
- **Rig interaction:** `watches`.
- **Art:** `assets/items/fish.svg` (`fish` in items-art.mjs). **Locale:** Text-free.

### Hamsi `hamsi` · P1

- **Why it's funny or lovable:** Canon: her favourite fish is the hamsi, the European anchovy. A goddess whose dream dinner is the smallest, cheapest fish at the market is the whole character on one plate: grand taste, humble cat.
- **Gag / beat:** On the last sentence her eyes slide to the plate (the treat guard). Planned: she 'only sniffs' one and it is gone (formula A), or says 'acceptable' while her tail quivers at it (B). (gags: favourite-fish, treat-guard; formula A, B)
- **Days:** ordinary days, moods: smug, soft, proud; lines: fd-09, fd-01, fd-24. Cooldown 10 days.
- **Rig interaction:** `guards`.
- **Art:** `assets/items/hamsi.svg` (`hamsi` in items-art.mjs). **Locale:** Text-free: three small fish on a blue-rimmed saucer. Always a whole fresh fish, never the salted fillet: in en, es, fr and pt-BR 'anchovy' can mean the pizza topping, so lines say 'my fish' or 'hamsi' and never 'salty'.

### Plain boiled chicken `boiled-chicken` · P1

- **Why it's funny or lovable:** The pinnacle. Every cat owner knows it: the fancy food gets a sniff, plain boiled chicken gets a full-body reaction. Her diva palate's highest award goes to the plainest thing in the kitchen.
- **Gag / beat:** Reserved for big days: steam curls, on the last sentence her eyes go to it and her ears give her away (the tell). Proposed as the day-100 reward (open question). (gags: boiled-chicken, treat-guard; formula D, B)
- **Days:** ordinary days, moods: proud, impressed, soft; lines: fd-02, fd-13. Cooldown 21 days.
- **Rig interaction:** `guards`.
- **Art:** `assets/items/boiled-chicken.svg` (`boiled-chicken` in items-art.mjs). **Locale:** Text-free: shredded pale strips in the brand-blue bowl, two curls of steam. No seasoning, no bones, ever: the vet-safe version is the funny one.

### Wet food pouch `wet-food-pouch` · P1

- **Why it's funny or lovable:** The ritual: the tear, the squeeze, the plop. She licks the gravy off every chunk, leaves the chunks, and announces she is starving.
- **Gag / beat:** Her eyes go to the saucer on the last sentence. Planned gag: she licked the sauce, the rest is yours. (gags: wet-food-ritual, treat-guard; formula A, C)
- **Days:** ordinary days, moods: curious, goof, smug; lines: fd-12. Cooldown 8 days.
- **Rig interaction:** `guards`.
- **Art:** `assets/items/wet-food-pouch.svg` (`wet-food-pouch` in items-art.mjs). **Locale:** Text-free: a teal pouch, a paw print, a torn zigzag top; gravy and chunks on a saucer.

### Tuna can `tuna-can` · P1

- **Why it's funny or lovable:** The sound of the can opener summons her from anywhere in the building: a verdict or a nap is abandoned mid-word. Tuna water (the drained liquid) is her idea of a cocktail.
- **Gag / beat:** Watched during the reaction beat, ears up (formula B). Wants an off-screen ring-pull SFX at the reveal (not built: needs a new sfx kind in lib/audio.mjs). (gags: can-opener, wet-food-ritual; formula B, C)
- **Days:** ordinary days, moods: curious, impressed, goof; lines: fd-22, fd-03. Cooldown 8 days.
- **Rig interaction:** `watches`.
- **Art:** `assets/items/tuna-can.svg` (`tuna-can` in items-art.mjs). **Locale:** No label text: a silver tin with a plain blue band and a fish silhouette; the ring-pull lid peeled up.

### Lickable treat tube `treat-tube` · P1

- **Why it's funny or lovable:** The one food that ends any cat's dignity: she follows the tube across the room, licking, eyes shut, and then claims she wasn't that interested.
- **Gag / beat:** On the last sentence her eyes slide to the squeezed tube. Planned: the tell at full volume (ears and tail) while she says 'meh'. (gags: treat-tube, treat-guard; formula A, B)
- **Days:** ordinary days, moods: goof, soft, smug. Cooldown 10 days.
- **Rig interaction:** `guards`.
- **Art:** `assets/items/treat-tube.svg` (`treat-tube` in items-art.mjs). **Locale:** Text-free: a squeezed pink tube with a curl of paste and a fresh mint one; stripes, no words.

### The “empty” bowl `empty-bowl` · P1

- **Why it's funny or lovable:** A cat truth every owner knows: the bowl is still three-quarters full, but the bottom shows in the middle, so it is EMPTY. A national emergency.
- **Gag / beat:** Watched during the reaction beat: she stares at the bare patch (its paw print showing) as if it were the number. Two kibbles she scooped out lie on the floor. (gags: empty-bowl; formula A, E)
- **Days:** ordinary days, moods: shocked, goof, curious; lines: fd-04. Cooldown 10 days.
- **Rig interaction:** `watches`.
- **Art:** `assets/items/empty-bowl.svg` (`empty-bowl` in items-art.mjs). **Locale:** Text-free: kibble round the rim, the bowl's own paw print visible in the middle.

### Pot of catnip `catnip` · P1

- **Why it's funny or lovable:** Catnip turns a goddess into a rolling, drooling mess for ten minutes, then she looks around as if nothing happened. The best formula C prop there is.
- **Gag / beat:** Watched during the reaction beat. Planned: one sniff wipes her verdict ('Mrrr… where was I?'); one leaf is already bitten. (gags: catnip, distraction; formula C)
- **Days:** ordinary days, moods: goof, curious, sleepy; lines: fd-10. Cooldown 12 days.
- **Rig interaction:** `watches`.
- **Art:** `assets/items/catnip.svg` (`catnip` in items-art.mjs). **Locale:** Text-free: a terracotta pot, toothed leaves, lilac flower spikes. In lines: catnip, kedi otu, hierba gatera, herbe à chat, Katzenminze, кошачья мята, erva-dos-gatos, نعناع القطط.

### Cat grass `cat-grass` · P1

- **Why it's funny or lovable:** She eats it with great ceremony, like a salad at a spa. What happens twenty minutes later stays off screen; the hairball is at most a sound and a cough, never a picture.
- **Gag / beat:** Watched during the reaction beat; two chewed blades flop over the rim. (gags: cat-grass, hairball; formula A, E)
- **Days:** ordinary days, moods: curious, goof; lines: fd-11. Cooldown 12 days.
- **Rig interaction:** `watches`.
- **Art:** `assets/items/cat-grass.svg` (`cat-grass` in items-art.mjs). **Locale:** Text-free: a white tray of bright straight blades.

### The water fountain `water-fountain` · P1

- **Why it's funny or lovable:** Someone bought her an expensive filtered fountain. She drinks from your glass, the tap, the shower and the plant saucer instead. The fountain is decor.
- **Gag / beat:** New interaction `ignores`: during the reaction her eyes go up and away from it, chin high; on the last sentence one sneaky glance back. (gags: water-snob; formula E, A)
- **Days:** ordinary days, moods: smug, diva, curious; lines: fd-05. Cooldown 10 days.
- **Rig interaction:** `ignores`.
- **Art:** `assets/items/water-fountain.svg` (`water-fountain` in items-art.mjs). **Locale:** Text-free: a white basin, a spout, a running arc of water.

### Your glass of water `water-glass` · P1

- **Why it's funny or lovable:** The only water worth drinking is in a human's glass. She dips a paw in first and licks the paw, as a quality check.
- **Gag / beat:** Watched during the reaction beat; a drip down the side and a puddle say the paw went in. Never knocked off: the bible keeps glasses out of the knock-off gag. (gags: water-snob; formula E)
- **Days:** ordinary days, moods: smug, goof, curious. Cooldown 10 days.
- **Rig interaction:** `watches`.
- **Art:** `assets/items/water-glass.svg` (`water-glass` in items-art.mjs). **Locale:** Text-free: a tall glass, half full, a ripple and a drip.

### The butter dish `butter-dish` · P1

- **Why it's funny or lovable:** The lid is off and the butter has a perfect tongue-shaped groove along one edge. Nobody saw anything. She was on the counter, where she is not allowed, which is why she is always there.
- **Gag / beat:** On the last sentence her eyes slide to it, then the innocent stare. Pairs with the Counter running gag. (gags: butter, the-counter; formula A, E)
- **Days:** ordinary days, moods: goof, smug, curious; lines: fd-07. Cooldown 14 days.
- **Rig interaction:** `guards`.
- **Art:** `assets/items/butter-dish.svg` (`butter-dish` in items-art.mjs). **Locale:** Text-free: a yellow block on a mint dish, the lid knocked aside, a licked scoop with tongue marks.

### Your plate `human-plate` · P1

- **Why it's funny or lovable:** The stolen bite: she ignores her own bowl to take one bite from yours, then acts as if the sandwich came that way.
- **Gag / beat:** On the last sentence her eyes slide to the plate; crumbs on the rim. A 'habit' poke at most: it is your snack, never your effort. (gags: stolen-bite, the-counter; formula A, E)
- **Days:** ordinary days, moods: goof, smug; lines: fd-08. Cooldown 14 days.
- **Rig interaction:** `guards`.
- **Art:** `assets/items/human-plate.svg` (`human-plate` in items-art.mjs). **Locale:** Text-free: a blue-rimmed plate, half a sandwich with a scalloped bite out of the corner.

### Yogurt pot and its lid `yogurt-lid` · P1

- **Why it's funny or lovable:** The lid is hers by law. The human peels it, she licks it to a mirror shine and considers it a shared meal. Tiny, real, and very Turkish-kitchen.
- **Gag / beat:** On the last sentence her eyes slide to the shiny lid on the floor. (gags: yogurt-lid, treat-guard; formula D, E)
- **Days:** ordinary days, moods: soft, proud, goof; lines: fd-14. Cooldown 12 days.
- **Rig interaction:** `guards`.
- **Art:** `assets/items/yogurt-lid.svg` (`yogurt-lid` in items-art.mjs). **Locale:** Text-free: a plain white pot with a blue band, a silver foil lid with a glint.

## Outfits and accessories

### Sunglasses `sunglasses` · P0

- **Why it's funny or lovable:** Peak diva act on a tiny cat with enormous ears; funnier the more serious she looks.
- **Gag / beat:** Day 7 paparazzi flashes; 'I say that to the sun too' (ro-07). (gags: the-wardrobe; formula B, A)
- **Days:** milestones 7; ordinary days, moods: smug, diva; lines: ro-07. Cooldown 5 days.
- **Rig interaction:** `wears-face`.
- **Art:** `assets/items/sunglasses.svg` (`sunglasses` in items-art.mjs). **Locale:** Text-free.

### Crown `crown` · P0

- **Why it's funny or lovable:** Named after a goddess; the crown is crooked, which is the whole joke.
- **Gag / beat:** Day 50 (the counter pose) and day 365 (a queen bows, briefly). (gags: the-wardrobe, the-counter; formula A, D)
- **Days:** milestones 50, 365; milestones only. Cooldown 30 days.
- **Rig interaction:** `wears-head`.
- **Art:** `assets/items/crown.svg` (`crown` in items-art.mjs). **Locale:** Gems are colours, no regalia of any real country.

### Knitted scarf `scarf` · P0

- **Why it's funny or lovable:** Cosy and a little too big for her; huggable.
- **Gag / beat:** Soft and praise days; never with the hoodie or onesie. (gags: the-wardrobe; formula D)
- **Days:** ordinary days, moods: soft, sleepy, proud. Cooldown 5 days.
- **Rig interaction:** `wears-neck`.
- **Art:** `assets/items/scarf.svg` (`scarf` in items-art.mjs). **Locale:** Text-free.

### Party hat `party-hat` · P0

- **Why it's funny or lovable:** Worn crooked off one ear by a cat who claims she does not celebrate.
- **Gag / beat:** Day 30 with the confetti cannon. (gags: the-wardrobe; formula D)
- **Days:** milestones 30; milestones only. Cooldown 30 days.
- **Rig interaction:** `wears-head`.
- **Art:** `assets/items/party-hat.svg` (`party-hat` in items-art.mjs). **Locale:** Text-free.

### Polka-dot bow `bow` · P0

- **Why it's funny or lovable:** She dressed up a little to meet you, and pretends she did not.
- **Gag / beat:** Day 1 (a little shy); 'This is my good side' (reg-04). (gags: the-wardrobe; formula B, D)
- **Days:** milestones 1; ordinary days, moods: soft, diva, proud; lines: reg-04. Cooldown 5 days.
- **Rig interaction:** `wears-head`.
- **Art:** `assets/items/bow.svg` (`bow` in items-art.mjs). **Locale:** Text-free.

### Headphones `headphones` · P1

- **Why it's funny or lovable:** Headphones on a cat whose ears stick straight up through them: a listening-practice joke on her own ears.
- **Gag / beat:** Ear-swivel days: the ears move, the headphones do not. (gags: the-ears-tell; formula B)
- **Days:** ordinary days, moods: curious, impressed. Cooldown 6 days.
- **Rig interaction:** `wears-head`.
- **Art:** `assets/items/headphones.svg` (`headphones` in items-art.mjs). **Locale:** Text-free.

### Reading glasses `reading-glasses` · P1

- **Why it's funny or lovable:** The judge's look, on a cat who sat on her notes.
- **Gag / beat:** Day 21 (the verdict), 'Today's verdict' (reg-14). (gags: the-verdict; formula B)
- **Days:** milestones 21; ordinary days, moods: smug; lines: reg-14, ro-13. Cooldown 6 days.
- **Rig interaction:** `wears-face`.
- **Art:** `assets/items/reading-glasses.svg` (`reading-glasses` in items-art.mjs). **Locale:** Text-free.

### Beret `beret` · P1

- **Why it's funny or lovable:** An artiste. Her ears push it off-centre.
- **Gag / beat:** Model-turn days. (gags: the-wardrobe; formula A)
- **Days:** ordinary days, moods: diva, proud. Cooldown 6 days.
- **Rig interaction:** `wears-head`.
- **Art:** `assets/items/beret.svg` (`beret` in items-art.mjs). **Locale:** A beret is international; no flag.

### Gold star sticker `gold-star` · P1

- **Why it's funny or lovable:** She gives you a gold star and wears it herself.
- **Gag / beat:** pr-08 'Gold star. Well, gold-green. Like my eyes.' (gags: the-verdict; formula D)
- **Days:** only when its line plays; lines: pr-08. Cooldown 30 days.
- **Rig interaction:** `wears-face`.
- **Art:** `assets/items/gold-star.svg` (`gold-star` in items-art.mjs). **Locale:** Text-free.

### Bow tie `bowtie` · P1

- **Why it's funny or lovable:** Black-tie for a speechless day.
- **Gag / beat:** Day 100; praise days. (gags: the-wardrobe; formula D)
- **Days:** milestones 100; ordinary days, moods: proud, impressed. Cooldown 6 days.
- **Rig interaction:** `wears-neck`.
- **Art:** `assets/items/bowtie.svg` (`bowtie` in items-art.mjs). **Locale:** Text-free.

### Pink onesie `onesie` · P0

- **Why it's funny or lovable:** Photo 11. Dignity under pressure; never explained.
- **Gag / beat:** Lines that mention it. (gags: the-wardrobe; formula A)
- **Days:** only when its line plays; lines: reg-05, ro-17. Cooldown 14 days.
- **Rig interaction:** `rig-outfit`.
- **Art:** drawn by the rig (`outfit`). **Locale:** Drawn by the rig.

### Red snowflake hoodie `hoodie` · P0

- **Why it's funny or lovable:** Photo 20. The winter and New Year look.
- **Gag / beat:** Day 10 poof; ro-02. (gags: the-wardrobe; formula D)
- **Days:** milestones 10; only when its line plays; lines: ro-02, ms-10-a. Cooldown 14 days.
- **Rig interaction:** `rig-outfit`.
- **Art:** drawn by the rig (`outfit`). **Locale:** Drawn by the rig.

### Mini backpack `mini-backpack` · P2

- **Why it's funny or lovable:** First day of school energy; ready to travel.
- **Gag / beat:** Walk-in entrances: she arrives packed. (gags: the-wardrobe, the-planet; formula A)
- **Days:** not in the grammar yet. Cooldown 8 days.
- **Rig interaction:** `wears-neck` — needs a new rig move: a back-straps layer on the body (straps over the shoulders in sit and stand).
- **Art:** not drawn yet. **Locale:** Text-free.

### Sleep mask on forehead `sleep-mask` · P2

- **Why it's funny or lovable:** Woken up for you; mask still on.
- **Gag / beat:** Wake-up entrance. (gags: the-slow-blink; formula C)
- **Days:** not in the grammar yet; lines: ro-04. Cooldown 8 days.
- **Rig interaction:** `wears-face`.
- **Art:** not drawn yet. **Locale:** Text-free.

### Graduation cap `graduation-cap` · P2

- **Why it's funny or lovable:** Language milestone energy.
- **Gag / beat:** Day 365 alternative. (gags: the-wardrobe; formula D)
- **Days:** not in the grammar yet. Cooldown 30 days.
- **Rig interaction:** `wears-head`.
- **Art:** not drawn yet. **Locale:** Tassel colours neutral.

### Collar with bell `collar-bell` · P2

- **Why it's funny or lovable:** A tiny jingle as SFX on every head move: the body tells.
- **Gag / beat:** Ear-tell days. (gags: the-wardrobe; formula B)
- **Days:** not in the grammar yet. Cooldown 8 days.
- **Rig interaction:** `wears-neck`.
- **Art:** not drawn yet. **Locale:** Text-free; no name tag (no names, ever).

## Language-learning props

### Flashcards `flashcards` · P0

- **Why it's funny or lovable:** Two cards: the viewer's own alphabet and another one. The exchange in one picture. She 'sat on her notes'.
- **Gag / beat:** Day 3 (a habit); reg-19 'I sat on my notes'. (gags: the-verdict; formula E, A)
- **Days:** milestones 3; ordinary days, any mood; lines: reg-19. Cooldown 6 days.
- **Rig interaction:** `beside`.
- **Art:** `assets/items/flashcards.svg` (`flashcards` in items-art.mjs). **Locale:** Front card shows the viewer's glyph (tr Ç, en A, es Ñ, fr É, de Ä, ru Ж, ar ع, pt-BR Ã); the back card a different script, rotating by day. No words.

### Tiny dictionary `dictionary` · P0

- **Why it's funny or lovable:** A fat little dictionary she clearly has not opened. 'I learned bag.'
- **Gag / beat:** Day 21 with the reading glasses; ro-11. (gags: the-verdict; formula E)
- **Days:** milestones 21; ordinary days, any mood; lines: ro-11. Cooldown 6 days.
- **Rig interaction:** `beside`.
- **Art:** `assets/items/dictionary.svg` (`dictionary` in items-art.mjs). **Locale:** Cover shows 'Aa' in a speech bubble only.

### Desk globe `globe` · P0

- **Why it's funny or lovable:** The world she claims to rule; it spins, she watches it like prey.
- **Gag / beat:** reg-15 'On my planet…'; curious days. Tall enough to show over the caption. (gags: the-planet; formula C)
- **Days:** ordinary days, moods: curious, impressed; lines: reg-15. Cooldown 6 days.
- **Rig interaction:** `watches`.
- **Art:** `assets/items/globe.svg` (`globe` in items-art.mjs). **Locale:** Land masses are soft blobs with no borders: no map politics in any locale.

### Speech-bubble sign `speech-sign` · P0

- **Why it's funny or lovable:** A protest-style sign held up for you, in three alphabets. Proud-fan energy she would deny.
- **Gag / beat:** Day 1 (meeting); praise days. Above the caption the whole video. (gags: the-ears-tell; formula D)
- **Days:** milestones 1; ordinary days, moods: proud, impressed, soft. Cooldown 6 days.
- **Rig interaction:** `beside`.
- **Art:** `assets/items/speech-sign.svg` (`speech-sign` in items-art.mjs). **Locale:** Shows A / Ж / ع: Latin, Cyrillic, Arabic, the app's eight locales' scripts. Glyphs, not words.

### Passport with stamps `passport` · P1

- **Why it's funny or lovable:** Her passport, stamped everywhere she has never been.
- **Gag / beat:** Curious and diva days. (gags: the-planet; formula A)
- **Days:** ordinary days, moods: curious, diva. Cooldown 8 days.
- **Rig interaction:** `beside`.
- **Art:** `assets/items/passport.svg` (`passport` in items-art.mjs). **Locale:** Stamps are shapes, no country names.

### Alphabet blocks `alphabet-blocks` · P2

- **Why it's funny or lovable:** She stacks them, then knocks the top one off.
- **Gag / beat:** Knock-off move. (gags: knocked-off-things; formula A)
- **Days:** not in the grammar yet. Cooldown 8 days.
- **Rig interaction:** `beside` — needs a new rig move: knock-off (bible §9.2 #3).
- **Art:** not drawn yet. **Locale:** One glyph per locale, like the flashcards.

### Postcard `postcard` · P2

- **Why it's funny or lovable:** A postcard from a partner's country, a picture side only.
- **Gag / beat:** Soft days. (gags: the-planet; formula D)
- **Days:** not in the grammar yet. Cooldown 8 days.
- **Rig interaction:** `beside`.
- **Art:** not drawn yet. **Locale:** Picture side only; no handwriting.

### Pencil `pencil` · P2

- **Why it's funny or lovable:** The bible's own knock-off object.
- **Gag / beat:** reg-12 'I knocked something off the counter in your honour.' (gags: knocked-off-things; formula A)
- **Days:** not in the grammar yet; lines: reg-12. Cooldown 14 days.
- **Rig interaction:** `beside` — needs a new rig move: knock-off (bible §9.2 #3).
- **Art:** not drawn yet. **Locale:** Text-free.

### Notebook (sat on) `notebook` · P2

- **Why it's funny or lovable:** 'I sat on my notes.' Literally.
- **Gag / beat:** reg-19 as a seat. (gags: the-verdict; formula A)
- **Days:** not in the grammar yet; lines: reg-19. Cooldown 14 days.
- **Rig interaction:** `sits-on`.
- **Art:** not drawn yet. **Locale:** Scribbles, no words.

## Milestone and seasonal props

### Rosette medal `medal` · P1

- **Why it's funny or lovable:** Out of verdicts (day 200): she awards herself, then you.
- **Gag / beat:** Day 200. (gags: the-verdict; formula D)
- **Days:** milestones 200; milestones only. Cooldown 30 days.
- **Rig interaction:** `wears-neck`.
- **Art:** `assets/items/medal.svg` (`medal` in items-art.mjs). **Locale:** No numbers, no text.

### Trophy `trophy` · P0

- **Why it's funny or lovable:** Day 100, the act breaks completely: the trophy is bigger than her head and she cannot speak.
- **Gag / beat:** Pops in at the number on day 100, glinting. (gags: the-verdict; formula D)
- **Days:** milestones 100; milestones only. Cooldown 30 days.
- **Rig interaction:** `beside`.
- **Art:** `assets/items/trophy.svg` (`trophy` in items-art.mjs). **Locale:** Plaque is blank: no numbers on screen besides the counter.

### Cake with one candle `cake` · P0

- **Why it's funny or lovable:** One candle, because cats can't count (bible §8.2). Lovable and quietly on-theme.
- **Gag / beat:** Day 200 and the big round days. (gags: the-slow-blink; formula D)
- **Days:** milestones 200; milestones only. Cooldown 30 days.
- **Rig interaction:** `beside`.
- **Art:** `assets/items/cake.svg` (`cake` in items-art.mjs). **Locale:** One candle, always: no number.

### Confetti cannon `confetti-cannon` · P0

- **Why it's funny or lovable:** Confetti starts at day 30 (bible §8.1); now it has a source, and it goes off a beat too early for her.
- **Gag / beat:** Fires exactly at the number on day 30. (gags: the-slow-blink; formula D)
- **Days:** milestones 30; milestones only. Cooldown 30 days.
- **Rig interaction:** `pops`.
- **Art:** `assets/items/confetti-cannon.svg` (`confetti-cannon` in items-art.mjs). **Locale:** Text-free.

### Gift box `gift-box` · P1

- **Why it's funny or lovable:** Day 365: she gives you something. It is probably the box she wants to sit in.
- **Gag / beat:** Day 365 next to the crown. (gags: the-bag; formula D)
- **Days:** milestones 365; milestones only. Cooldown 30 days.
- **Rig interaction:** `beside`.
- **Art:** `assets/items/gift-box.svg` (`gift-box` in items-art.mjs). **Locale:** Text-free.

### Balloon `balloon` · P1

- **Why it's funny or lovable:** Floats high where the caption can't hide it; she eyes it like the next thing to knock down.
- **Gag / beat:** Day 50 with the crown. (gags: the-counter; formula D)
- **Days:** milestones 50; milestones only. Cooldown 30 days.
- **Rig interaction:** `floats`.
- **Art:** `assets/items/balloon.svg` (`balloon` in items-art.mjs). **Locale:** Text-free.

### Fridge edge (set piece) `fridge-edge` · P2

- **Why it's funny or lovable:** The Fridge arc: misses on 7, 30, 50, makes it on 100.
- **Gag / beat:** Ledge at the frame edge for the jump-fail. (gags: the-fridge; formula A)
- **Days:** not in the grammar yet; lines: reg-06. Cooldown 30 days.
- **Rig interaction:** `beside` — needs a new rig move: jump-fail (bible §9.2 #1).
- **Art:** not drawn yet. **Locale:** Text-free.

### Mirror frame `mirror-frame` · P2

- **Why it's funny or lovable:** Her one rival lives in it.
- **Gag / beat:** ro-01 'It copied me. Rude.' (gags: the-mirror-cat; formula A)
- **Days:** not in the grammar yet; lines: ro-01. Cooldown 30 days.
- **Rig interaction:** `beside` — needs a new rig move: mirror double (bible §9.2 #10).
- **Art:** not drawn yet. **Locale:** Text-free.

### Snow globe (seasonal) `snow-globe` · P2

- **Why it's funny or lovable:** Winter look with the hoodie.
- **Gag / beat:** In-app or campaign renders only: the shared streak video is keyed by streak day and cannot know the date. (gags: the-wardrobe; formula C)
- **Days:** seasonal campaigns only, never the streak video. Cooldown 30 days.
- **Rig interaction:** `watches`.
- **Art:** not drawn yet. **Locale:** Hemisphere and holidays differ by locale; another reason to keep seasons out of the streak video.

### Pumpkin (seasonal) `pumpkin` · P2

- **Why it's funny or lovable:** A hollow pumpkin is a seat.
- **Gag / beat:** Campaign renders only (date-keyed). (gags: the-bag; formula A)
- **Days:** seasonal campaigns only, never the streak video. Cooldown 30 days.
- **Rig interaction:** `sits-in`.
- **Art:** not drawn yet. **Locale:** Halloween is not universal across the eight locales.

