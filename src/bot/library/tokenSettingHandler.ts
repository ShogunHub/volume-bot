import { bot } from "..";
import axios from "axios";
import tokenController from "../../controller/tokenSetting";
import config from "../../config.json";
import { removeAnswerCallback } from "./index";
const { PublicKey, Connection } = require("@solana/web3.js");
const connection = new Connection(config.rpcUrl);

interface TtokenInfo {
  userId: number;
  name: string;
  symbol: string;
  pairInfo: any;
  decimal: number;
  publicKey: string;
}
export let timeline = 0;
export let tokenInfo: TtokenInfo | null | undefined;

export const tokenSettingHandler = async (msg: any) => {
  try {
    await removeAnswerCallback(msg.chat);
    timeline = 0;
    tokenInfo = null;
    const user = await tokenController.findOne({
      filter: {
        userId: msg.chat.id,
      },
    });
    if (!user) {
      if (
        ![
          "/cancel",
          "/support",
          "/start",
          "/wallet",
          "/token",
          "/deposit",
          "/withdraw",
          "/balance",
          "/activity",
        ].includes(msg.text)
      ) {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: msg.chat.id, message_id: msg.message_id }
        );
      }
      await bot
        .sendMessage(
          msg.chat.id,
          `
<b>Please enter the token address to swap.</b>`,
          {
            parse_mode: "HTML",
            reply_markup: {
              force_reply: true,
            },
          }
        )
        .then(async (sentMessage) => {
          await bot.onReplyToMessage(
            sentMessage.chat.id,
            sentMessage.message_id,
            async (reply) => {
              const tokenAddress = reply.text?.trim() as string;
              if (
                [
                  "/cancel",
                  "/support",
                  "/start",
                  "/wallet",
                  "/token",
                  "/deposit",
                  "/withdraw",
                  "/balance",
                  "/activity",
                ].includes(tokenAddress)
              ) {
                return;
              }
              tokenInfo = await isValidSolanaToken(tokenAddress, msg);
              if (tokenInfo) {
                const r = await tokenController.create(tokenInfo);
                if (r) {
                  await bot.sendMessage(
                    msg.chat.id,
                    `Setting is completed successfully .
  
🟣 <b>Token Address: </b> <code>${tokenInfo.publicKey}</code>

🟢 <b>Token Name: </b> ${tokenInfo.name}

🟠 <b>Token Symbol: </b> ${tokenInfo.symbol}`,
                    {
                      parse_mode: "HTML",
                      reply_markup: {
                        inline_keyboard: [
                          [
                            {
                              text: "Return 👈",
                              callback_data: "return",
                            },
                            {
                              text: "Delete 👈",
                              callback_data: "delete_token",
                            },
                          ],
                        ],
                      },
                    }
                  );
                }
              } else {
                await promptForTokenAddress(msg);
              }
            }
          );
        });
    } else {
      let marketCap = 0;
      const response = await axios(`${config.dexAPI}/${user.publicKey}`);
      if (response?.status == 200 && response?.data?.pairs) {
        marketCap = response.data.pairs[0].marketCap;
      } else {
        await bot.sendMessage(
          msg.chat.id,
          `API request failed. Please try again.`,
          {}
        );
        return;
      }
      await bot.sendMessage(
        msg.chat.id,
        `
✅ Token is valid.

🟣 <b>Token Address: </b> <code>${user.publicKey}</code>

🟢 <b>Token Name: </b> ${user.name}

🟠 <b>Token Symbol: </b> ${user.symbol}

🔵 <b>Token MarketCap: </b>  $ ${marketCap}
  `,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Return 👈", callback_data: "return" },
                {
                  text: "Delete 👈",
                  callback_data: "delete_token",
                },
              ],
            ],
          },
        }
      );
    }
  } catch (err) {
    console.log("Error token Setting: ", err);
  }
};

const isValidSolanaToken = async (tokenAddress: string | any, msg: any) => {
  try {
    const response = await axios(`${config.dexAPI}/${tokenAddress}`);
    if (response?.status == 200 && response?.data?.pairs) {
      let data = response.data.pairs;
      const info = await connection.getParsedAccountInfo(
        new PublicKey(tokenAddress)
      );
      const decimal = info?.value?.data?.parsed?.info?.decimals;
      let pairInfo = [];
      for (let i = 0; i < data.length; i++) {
        if (
          data[i].dexId === "raydium" &&
          data[i].baseToken.address === tokenAddress
        ) {
          pairInfo.push({
            inToken: data[i].quoteToken.address,
            inName: data[i].quoteToken.name,
            inSymbol: data[i].quoteToken.symbol,
            inLiquidity: data[i].liquidity.quote,
            outLiquidity: data[i].liquidity.base,
            pairAddress: data[i].pairAddress,
          });
        }
      }
      const tokenInfo = {
        userId: msg.chat.id,
        name: response.data.pairs[0].baseToken.name,
        symbol: response.data.pairs[0].baseToken.symbol,
        pairInfo: pairInfo,
        decimal: decimal,
        publicKey: tokenAddress,
      } as TtokenInfo;
      return tokenInfo;
    } else {
      return null;
    }
  } catch (error) {
    console.log("isValidSolanaTokenError: ", error);
  }
};

const promptForTokenAddress = async (msg: any) => {
  try {
    await bot
      .sendMessage(
        msg.chat.id,
        `
<b>Please the valid token address.</b>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            force_reply: true,
          },
        }
      )
      .then(async (sentMessage) => {
        await bot.onReplyToMessage(
          sentMessage.chat.id,
          sentMessage.message_id,
          async (reply) => {
            const tokenAddress = reply.text?.trim() as string;
            if (
              [
                "/cancel",
                "/support",
                "/start",
                "/wallet",
                "/token",
                "/deposit",
                "/withdraw",
                "/balance",
                "/activity",
              ].includes(tokenAddress)
            ) {
              return;
            }
            const tokenInfo = await isValidSolanaToken(tokenAddress, msg);
            if (tokenInfo) {
              const r = await tokenController.create(tokenInfo);
              if (r) {
                await bot.sendMessage(
                  msg.chat.id,
                  `Setting is completed successfully.

🟣 <b>Token Address: </b> <code>${tokenInfo.publicKey}</code>

🟢 <b>Token Name: </b> ${tokenInfo.name}

🟠 <b>Token Symbol: </b> ${tokenInfo.symbol}`,
                  {
                    parse_mode: "HTML",
                    reply_markup: {
                      inline_keyboard: [
                        [
                          {
                            text: "Return 👈",
                            callback_data: "return",
                          },
                        ],
                      ],
                    },
                  }
                );
              }
            } else {
              return promptForTokenAddress(msg);
            }
          }
        );
      });
  } catch (error) {
    console.log("promptForTokenAddressError: ", error);
  }
};
