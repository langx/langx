package tech.newchapter.languageXchange.wear

import android.app.Activity
import android.app.RemoteInput
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material.LocalTextStyle
import androidx.wear.compose.material.Text
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController

/**
 * The Wear OS app.
 *
 * The Android twin of `targets/watch/LangXWatchApp.swift`, drawn to the same
 * mockup — `docs/plans/iphone-watch-and-carplay/watch.png`. One link for the
 * whole app, created here and handed down, because there is one Data Layer
 * connection and it has one listener.
 *
 * Why it exists at all and why it is dependent rather than standalone is in
 * `docs/plans/iphone-watch-and-carplay.md` → _Surface B_; the plan wrote that
 * section about Apple and every word of it is true here.
 */
class MainActivity : ComponentActivity() {

  private lateinit var link: PhoneLink

  /**
   * Wear's own text entry, which is the platform's answer to `TextFieldLink`:
   * a screen that offers dictation, the on-screen keyboard and handwriting and
   * lets the wearer choose. Opening one of them directly would be the mistake
   * — dictation is unusable in a quiet room and a keyboard is unusable while
   * walking.
   */
  private var onReply: ((String) -> Unit)? = null

  private val entry =
      registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode != Activity.RESULT_OK) return@registerForActivityResult
        val text =
            result.data?.let { RemoteInput.getResultsFromIntent(it) }?.getCharSequence(REPLY_KEY)
        if (text != null) onReply?.invoke(text.toString())
      }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    link = PhoneLink(applicationContext)

    setContent {
      val navigation = rememberSwipeDismissableNavController()

      DisposableEffect(Unit) {
        link.start()
        onDispose { link.stop() }
      }

      Box(modifier = Modifier.fillMaxSize().background(Palette.background)) {
        SwipeDismissableNavHost(navController = navigation, startDestination = "unread") {
          composable("unread") { UnreadList(link, navigation) }
          composable("thread/{id}") { entry ->
            ThreadScreen(link, entry.arguments?.getString("id").orEmpty(), ::askForReply)
          }
        }
      }
    }
  }

  private fun askForReply(send: (String) -> Unit) {
    onReply = send
    val input = RemoteInput.Builder(REPLY_KEY).setLabel(getString(R.string.watch_reply)).build()
    val intent = Intent(RemoteInput.EXTRA_RESULTS_DATA)
    entry.launch(
        androidx.wear.input.RemoteInputIntentHelper.putRemoteInputsExtra(
            androidx.wear.input.RemoteInputIntentHelper.createActionRemoteInputIntent(),
            listOf(input),
        )
    )
  }

  private companion object {
    const val REPLY_KEY = "reply"
  }
}

/**
 * The first screen: who is waiting.
 *
 * Three states, and the difference between the last two is the one worth
 * getting right. **Conversations** is the ordinary case. **No payload** means
 * the phone has never spoken to this watch, and the answer is to go and open
 * the app. **An empty list** means it spoke and there is nothing unread, which
 * is good news and must not look like a failure.
 */
@Composable
private fun UnreadList(link: PhoneLink, navigation: NavHostController) {
  val payload = link.payload

  when {
    payload == null -> Placeholder(R.string.watch_openOnPhone)
    payload.conversations.isEmpty() -> Placeholder(R.string.watch_nothingUnread)
    else ->
        ScalingLazyColumn(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
          item {
            Text(
                text = stringResource(R.string.watch_unread),
                color = Palette.primary,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.fillMaxWidth().padding(start = 8.dp),
                textAlign = TextAlign.Start,
            )
          }
          items(payload.conversations) { conversation ->
            ConversationRow(conversation) { navigation.navigate("thread/${conversation.id}") }
          }
        }
  }
}

@Composable
private fun ConversationRow(conversation: WearConversation, onClick: () -> Unit) {
  androidx.wear.compose.material.Chip(
      onClick = onClick,
      modifier = Modifier.fillMaxWidth(),
      colors =
          androidx.wear.compose.material.ChipDefaults.chipColors(
              backgroundColor = Palette.fill,
              contentColor = Palette.text,
          ),
      shape = RoundedCornerShape(14.dp),
      label = {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
          AvatarDisc(conversation.name)
          Spacer(Modifier.size(8.dp))
          Column(modifier = Modifier.weight(1f)) {
            Text(
                text = conversation.name,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = Palette.text,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            conversation.messages.lastOrNull()?.let {
              Text(
                  text = it.body,
                  fontSize = 13.sp,
                  color = Palette.textMuted,
                  maxLines = 1,
                  overflow = TextOverflow.Ellipsis,
                  // The message's own direction, not the watch's. See `Bubble`.
                  style = LocalTextStyle.current.copy(textDirection = TextDirection.Content),
              )
            }
          }
          /*
           A dot, not a count. Nobody acts differently at two unread messages
           in one thread than at one, and on a screen this size the number
           costs the name a character. The dot says "this one".
          */
          if (conversation.unread > 0) {
            Spacer(Modifier.size(4.dp))
            Box(Modifier.size(7.dp).clip(CircleShape).background(Palette.accent))
          }
        }
      },
  )
}

/**
 * Both empty states, drawn the same way.
 *
 * The words come from `strings_generated.xml`, which the string generator
 * writes from the app's own eight catalogues — the same list that fills the
 * Apple catalogue, so the two watches cannot drift apart in wording.
 */
@Composable
private fun Placeholder(resource: Int) {
  Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
    Text(
        text = stringResource(resource),
        color = Palette.textMuted,
        fontSize = 13.sp,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(horizontal = 16.dp),
    )
  }
}

/**
 * One thread, and the only thing this app does other than read: a reply.
 *
 * **The yellow is the rule, not a choice.** `MessageBubble.tsx` states it for
 * the app: yellow is the committing action, once per screen, and that is the
 * send button. So the bubbles are blue and grey exactly as they are on the
 * phone and on the Apple Watch, and Reply is the only yellow here.
 */
@Composable
private fun ThreadScreen(
    link: PhoneLink,
    conversationId: String,
    askForReply: ((String) -> Unit) -> Unit,
) {
  val conversation = link.conversation(conversationId)
  if (conversation == null) {
    Placeholder(R.string.watch_openOnPhone)
    return
  }

  ScalingLazyColumn(
      modifier = Modifier.fillMaxSize(),
      verticalArrangement = Arrangement.spacedBy(6.dp),
  ) {
    item {
      Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        AvatarDisc(conversation.name, size = 22)
        Spacer(Modifier.size(6.dp))
        Text(
            text = conversation.name,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = Palette.text,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
      }
    }

    items(conversation.messages) { message -> Bubble(message) }

    item {
      androidx.wear.compose.material.Chip(
          onClick = { askForReply { text -> link.reply(conversationId, text) } },
          modifier = Modifier.fillMaxWidth(),
          enabled = link.reachable,
          shape = RoundedCornerShape(50),
          colors =
              androidx.wear.compose.material.ChipDefaults.chipColors(
                  backgroundColor = Palette.primary,
                  contentColor = Palette.primaryInk,
              ),
          label = {
            Text(
                text = stringResource(R.string.watch_reply),
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )
          },
      )
    }

    item {
      val state = link.sending[conversationId]
      if (state != null) {
        Text(
            text =
                stringResource(
                    when (state) {
                      PhoneLink.SendState.SENDING -> R.string.watch_sending
                      PhoneLink.SendState.SENT -> R.string.watch_sent
                      PhoneLink.SendState.FAILED -> R.string.watch_notSent
                    }
                ),
            color = if (state == PhoneLink.SendState.FAILED) Palette.warning else Palette.textMuted,
            fontSize = 12.sp,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
      }
    }
  }
}

/**
 One message.

 `TextDirection.Content` rather than the default, which follows the *locale*.
 This is a language-exchange app: an Arabic speaker's thread is full of
 English and an English speaker's is full of Arabic, so the paragraph
 direction has to come from the sentence rather than from the watch's
 settings. Without it an English message shown to an Arabic reader is laid out
 right-to-left and its trailing punctuation jumps to the far side — the
 question mark of "is this right?" ends up in front of the question.
 */
@Composable
private fun Bubble(message: WearMessage) {
  Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = if (message.mine) Arrangement.End else Arrangement.Start,
  ) {
    Box(
        modifier =
            Modifier.clip(RoundedCornerShape(13.dp))
                .background(if (message.mine) Palette.accentBg else Palette.fill)
                .padding(horizontal = 9.dp, vertical = 6.dp)
    ) {
      Text(
          text = message.body,
          fontSize = 14.sp,
          color = Palette.text,
          style = LocalTextStyle.current.copy(textDirection = TextDirection.Content),
      )
    }
  }
}

/** The coloured disc with a letter on it, as the mockup draws it. */
@Composable
private fun AvatarDisc(name: String, size: Int = 30) {
  Box(
      modifier = Modifier.size(size.dp).clip(CircleShape).background(Palette.avatarFor(name)),
      contentAlignment = Alignment.Center,
  ) {
    Text(
        text = Palette.initialFor(name),
        // Every disc colour is a light one, so the letter is always the dark
        // ink rather than a per-colour decision.
        color = Palette.primaryInk,
        fontSize = (size * 0.45).sp,
        fontWeight = FontWeight.Bold,
    )
  }
}
