import { Telegraf } from "telegraf";
import userModel from "./src/models/User.model.js";
import connectDB from "./src/config/db.js";
const bot = new Telegraf(process.env.BOT_TOKEN);

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

bot.launch();
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
