import { Telegraf } from "telegraf";
import OpenAI from "openai";
import { message } from "telegraf/filters";
import userModel from "./src/models/User.model.js";
import eventModel from "./src/models/Event.model.js";
import connectDB from "./src/config/db.js";
const bot = new Telegraf(process.env.BOT_TOKEN);

const openai = new OpenAI({
  apiKey: process.env["OPENAI_KEY"],
});

try {
  connectDB();
  console.log("Database connected successfully");
} catch (error) {
  console.log("Database connection failed", error);
  process.kill(process.pid, "SIGTERM");
}
bot.start(async (ctx) => {
  const from = ctx.update.message.from;
  try {
    await userModel.findOneAndUpdate(
      {
        tgId: from.id,
      },
      {
        $setOnInsert: {
          firtname: from.first_name,
          lastname: from.last_name,
          isBot: from.is_bot,
          username: from.username,
        },
      },
      { upsert: true, new: true }
    );
    //store the user infromation into db
    await ctx.reply(
      `Hey! ${from.first_name}, Welcome, I will be writing highly engaging social media posts for you. Just keep feeding me with the events thought the day. Let's shine on social media`
    );
  } catch (error) {
    console.log(error);
    await ctx.reply("Facing difficulties!!");
  }
});

bot.command("generate", async (ctx) => {
  const from = ctx.update.message.from;
  const { message_id: waitingMessageId } = await ctx.reply(
    `Hey! ${from.first_name}, kindly wait for a moment. I am curating posts for you`
  );

  //   const {message_id: loadingStickerMsgId} = await ctx.replyWithSticker(
  //     Stickerid chahiye yaha
  //   )

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  try {
    //get events for the user
    const events = await eventModel.find({
      tgId: from.id,
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });
    if (events.length === 0) {
      // await ctx.deleteMessage(loadingStickerMsgId);
      await ctx.deleteMessage(waitingMessageId);
      await ctx.reply("No events for the day");
      return;
    }
    console.log(events);
    //make openai api call
    try {
      const chatCompletion = await openai.chat.completions.create({
        messages: [
          {
            role: `system`,
            content: `Act as senior copywriter, you write highly engaging posts for linkedin, facebook and twitter using provided thoughts/events trought the day`,
          },
          {
            role: `user`,
            content: `Write like a human, for humans. Craft three engaging social media psots tailored for LinkedIn, Facebook and Twitter audience. Use simple language. Use given time liabels just to understand the order of the event, don't mention the time in the posts. Each post should creatively highlight the following events. Ensure the tone is conversational and impactful. Focus on engaging the respectively platform's audience, encouraging interaction and driving interest in the events: ${events
              .map((event) => event.text)
              .join(",")}`,
          },
        ],
        model: process.env.OPENAI_MODEL,
      });
      //   console.log(chatCompletion);
      //store token count
      await userModel.findOneAndUpdate(
        {
          tgId: from.id,
        },
        {
          $inc: {
            promptTokens: chatCompletion.usage.prompt_tokens,
            completionTokens: chatCompletion.usage.completion_tokens,
          },
        }
      );
      //   await ctx.deleteMessage(loadingStickerMsgId);
      await ctx.deleteMessage(waitingMessageId);
      await ctx.reply(chatCompletion.choices[0].message.content);
    } catch (error) {
      console.log("Facing error while generating text from openAi", error);
    }

    //send response
  } catch (error) {
    console.log("Error while sending summary", error);
  }
});

// bot.on(message("sticker"), async(ctx) => {
// console.log(sticker)
// })

bot.on(message("text"), async (ctx) => {
  const from = ctx.update.message.from;
  const message = ctx.update.message.text;

  try {
    await eventModel.create({
      text: message,
      tgId: from.id,
    });
    await ctx.reply(
      "Noted, Keep texting me your thoughts. To generates the posts, Just enter the command: /generate"
    );
  } catch (error) {
    console.log(err);
    await ctx.reply("Facing defficulties pls try again later");
  }
});

bot.launch();
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
