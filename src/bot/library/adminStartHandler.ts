import { bot } from "../index";
import { SendMessageOptions } from "node-telegram-bot-api";
import depositSettingController from "../../controller/adminSetting";
import adminListController from "../../controller/adminList";
import { generateCallbackOption } from "./index";
import { deleteMessage, deleteMessage1 } from "./index";
import { adminReturnHandler } from "../library/returnHandler";
import config from "../../config.json";

interface TadminStatus {
  depositEdit: boolean;
  gasFeeEdit: boolean;
  addAdmin: boolean;
}

interface TadminData {
  userId: number;
  userName: string;
}

interface TadminDetail {
  text: string;
  callback_data: string;
}

let adminStatus: TadminStatus = {
  depositEdit: false,
  gasFeeEdit: false,
  addAdmin: false,
};

let depositMiniAmount = 0 as number;
let gasFee = 0 as number;

export const adminStartHandler = async (msg: any) => {
  try {
    await bot.sendMessage(
      msg.chat.id,
      `
  Welcome to <b>Admin Shogun Temper Bot!</b>
  
  Click the button below to proceed with the setup.
      `,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Admin Setup  ✔️", callback_data: "setup_admin" },
              { text: "Deposit Setup  ✔️", callback_data: "deposit_setup" },
            ],
            [{ text: "Return  👈", callback_data: "main_return" }],
          ],
        },
      }
    );
  } catch (error) {
    console.log("adminStartHandlerError: ", error);
  }
};

bot.on("callback_query", async (callbackQuery) => {
  const msg = callbackQuery.message;
  if (msg) {
    const callbackData = callbackQuery.data;
    switch (callbackData) {
      case "deposit_setting":
        depositAmountModal(msg);
        adminStatus.depositEdit = true;
        break;

      case "main_return":
        adminStatus = {
          depositEdit: false,
          gasFeeEdit: false,
          addAdmin: false,
        };
        deleteMessage(msg);
        adminReturnHandler(msg);
        break;

      case "setup_admin":
        addAdmin(msg);
        break;

      case "add_admin":
        adminStatus.addAdmin = true;
        addAdminModal(msg);
        break;

      case "deposit_setup":
        depositSettingHandler(msg);
        break;

      case "admin_ui":
        await deleteMessage(msg);
        await adminStartHandler(msg);
        break;

      case "setting_save":
        resultShowModal(msg);
        break;

      case "prev_return":
        addAdmin(msg);
        break;

      default: {
        if (callbackData?.startsWith("select_")) {
          selectAdminModal(msg, callbackData);
        } else if (callbackData?.startsWith("adminDelete_")) {
          const userId = Number(callbackData.split("_")[1]);
          adminDeleteConfirm(msg, userId);
        }
        break;
      }
    }
  }
});

bot.on("message", async (msg: any) => {
  if (msg.text && msg.text.startsWith("/")) return;

  const chatId = msg.chat.id;

  if (msg.text) {
    if (isSuperAdmin(chatId)) {
      if (adminStatus.depositEdit) {
        if (!isNaN(msg.text)) {
          depositMiniAmount = Number(msg.text);
          adminStatus.depositEdit = false;
          adminStatus.gasFeeEdit = true;
          await gasFeeEditModal(msg);
        } else {
          await validatorModal(msg);
        }
      } else if (adminStatus.gasFeeEdit) {
        if (!isNaN(msg.text) && Number(msg.text) < 100) {
          gasFee = Number(msg.text);
          adminStatus.gasFeeEdit = false;
          await settingShowModal(msg);
        } else {
          await validatorModal(msg);
        }
      } else if (adminStatus.addAdmin) {
        const adminData = msg.text.split("_");
        if (adminData?.length == 2) {
          const addAdmin = {
            userId: Number(adminData[0]),
            userName: adminData[1],
          };
          const result = await adminListController.create(addAdmin);
          await addAdminResultModal(result, msg);
        } else {
          await adminValidatorModal(msg);
        }
      }
    } else {
      await alertModal(msg);
    }
  }
});

const addAdmin = async (msg: any) => {
  try {
    await deleteMessage(msg);
    let opts = {};
    let newText = `` as string;
    const baseOption = await generateCallbackOption(msg, "HTML");
    const adminData = (await adminListController.find()) as Array<TadminData>;
    if (adminData?.length > 0) {
      const replyMarks = await adminData.map((item: any) => {
        return [
          {
            text: `${item.userName} (${item.userId})`,
            callback_data: `select_${item.userId}_${item.userName}`,
          },
        ];
      });
      newText = `Here are admin list.`;
      opts = {
        ...baseOption,
        reply_markup: {
          inline_keyboard: [
            ...replyMarks,
            [
              {
                text: "Return  👈",
                callback_data: "admin_ui",
              },
              {
                text: "Add Admin",
                callback_data: "add_admin",
              },
            ],
          ],
        },
      };
    } else {
      newText = `You are the only admin of this bot.`;
      opts = {
        ...baseOption,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Return  👈",
                callback_data: "admin_ui",
              },
              {
                text: "Add Admin",
                callback_data: "add_admin",
              },
            ],
          ],
        },
      };
    }

    await bot.sendMessage(msg.chat.id, newText, opts as SendMessageOptions);
  } catch (error) {
    console.log("addAdmin: ", error);
  }
};

const addAdminModal = async (msg: any) => {
  try {
    await deleteMessage(msg);
    const baseOption = await generateCallbackOption(msg, "HTML");
    const opts = { ...baseOption };
    const newText =
      `Please enter admin ID with userName.\n\n` + `<b>ex: 000000_King</b>`;
    await bot.sendMessage(msg.chat.id, newText, opts as SendMessageOptions);
  } catch (error) {
    console.log("addAdminModal: ", error);
  }
};
const selectAdminModal = async (msg: any, data: any) => {
  try {
    await deleteMessage(msg);
    const userId = Number(data.split("_")[1]);
    const userName = data.split("_")[2];
    const newText =
      `<b>ID: </b> ${userId}\n\n` + `<b>UserName: </b> ${userName}`;
    await bot.sendMessage(msg.chat.id, newText, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Return  👈", callback_data: "prev_return" },
            { text: "Delete  ✔️", callback_data: `adminDelete_${userId}` },
          ],
        ],
      },
    });
  } catch (error) {
    console.log("selectAdminModal: ", error);
  }
};
const depositSettingHandler = async (msg: any) => {
  try {
    await deleteMessage(msg);
    const data = await depositSettingController.findOne({
      filter: {
        userId: msg.chat.id,
      },
    });
    let headerText = "" as string;
    if (data) {
      headerText =
        `Welcome to Admin Shogun Temper Bot!\n\n` +
        `Deposit MiniAmount: ${data.miniAmount} SOL \n\n` +
        `Gas Fee : ${data.fee} %`;
    } else {
      headerText =
        `Welcome to Admin Shogun Temper Bot!\n\n` +
        `Please Set up the Deposit MiniAmount and the Gas Fee (percent).`;
    }

    bot.sendMessage(msg.chat.id, headerText, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Return  👈", callback_data: "admin_ui" },
            { text: "Setting  ✔️", callback_data: "deposit_setting" },
          ],
        ],
      },
    });
  } catch (error) {
    console.log("DepositSetting in admin management: ", error);
  }
};

const depositAmountModal = async (msg: any) => {
  try {
    await deleteMessage(msg);
    const newText = `Please Enter the Deposit MiniAmount.\n\n` + `ex: 0.5 `;
    await bot.sendMessage(msg.chat.id, newText, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "Return  👈", callback_data: "admin_ui" }]],
      },
    });
  } catch (error) {
    console.log("DepositAmountModal in adminSetting: ", error);
  }
};
const gasFeeEditModal = async (msg: any) => {
  try {
    await deleteMessage(msg);
    await deleteMessage1(msg, msg.message_id - 1);
    const newText =
      `<b>Deposit MiniAmount: </b>  ${msg.text} \n\n` +
      `Please Enter the Gas Fee. (%)\n` +
      `ex: 20`;
    await bot.sendMessage(msg.chat.id, newText, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "Return  👈", callback_data: "admin_ui" }]],
      },
    });
  } catch (error) {
    console.log("GasFeeEditModal in adminSetting: ", error);
  }
};

const adminValidatorModal = async (msg: any) => {
  try {
    await deleteMessage1(msg, msg.message_id - 1);
    const baseOption = await generateCallbackOption(msg, "HTML");
    const opts = { ...baseOption };
    const newText = `Please enter the valid type.`;
    await bot.sendMessage(msg.chat.id, newText, opts as SendMessageOptions);
  } catch (error) {
    console.log("adminValidatorModal in adminStartHandler:", error);
  }
};

const validatorModal = async (msg: any) => {
  try {
    await deleteMessage1(msg, msg.message_id - 1);
    await bot.sendMessage(
      msg.chat.id,
      `
      Please Valid Amount.
      `,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Return  👈", callback_data: "deposit_setting" }],
          ],
        },
      }
    );
  } catch (error) {
    console.log("validatorModal in adminStartHandler: ", error);
  }
};

const settingShowModal = async (msg: any) => {
  try {
    await deleteMessage(msg);
    await deleteMessage1(msg, msg.message_id - 1);
    const newText =
      `<b>Setup is ready.</b>\n\n` +
      `<b>Deposit MiniAmout: </b>  ${depositMiniAmount} SOL\n` +
      `<b>Gas Fee: </b>  ${gasFee} %`;
    await bot.sendMessage(msg.chat.id, newText, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Return  👈", callback_data: "admin_ui" },
            { text: "Save  👈", callback_data: "setting_save" },
          ],
        ],
      },
    });
  } catch (error) {
    console.log("SettingShowModal in adminStartHandler: ", error);
  }
};

const alertModal = async (msg: any) => {
  try {
    await deleteMessage(msg);
    const baseOption = await generateCallbackOption(msg, "HTML");
    const opts = { ...baseOption };
    await bot.sendMessage(
      msg.chat.id,
      `
      <b>You aren't SuperAdmin.</b>
      `,
      opts as SendMessageOptions
    );
  } catch (error) {
    console.log("AlertModal in adminStartHandler: ", error);
  }
};

const resultShowModal = async (msg: any) => {
  try {
    await deleteMessage(msg);
    const data = {
      userId: msg.chat.id,
      miniAmount: depositMiniAmount,
      fee: gasFee,
    };
    const result = await depositSettingController.create(data);
    await bot.sendMessage(msg.chat.id, `${result.msg}`, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "Return  👈", callback_data: "main_return" }],
        ],
      },
    });
  } catch (error) {
    console.log("resultShowModal in adminStartHandler:", error);
  }
};

const addAdminResultModal = async (result: any, msg: any) => {
  try {
    await deleteMessage1(msg, msg.message_id - 1);
    const baseOption = await generateCallbackOption(msg, "HTML");
    const opts = { ...baseOption };
    adminStatus.addAdmin = false;
    await bot.sendMessage(
      msg.chat.id,
      `${result?.msg}`,
      opts as SendMessageOptions
    );
  } catch (error) {
    console.log("AddAdminResultModal in adminStartHandler:", error);
  }
};

const adminDeleteConfirm = async (msg: any, userId: number) => {
  try {
    await deleteMessage(msg);
    const result = await adminListController.deleteOne({
      filter: { userId: userId },
    });
    const baseOption = await generateCallbackOption(msg, "HTML");
    const opts = { ...baseOption };
    if (result) {
      await bot.sendMessage(
        msg.chat.id,
        `Delete is completed`,
        opts as SendMessageOptions
      );
    }
  } catch (error) {
    console.log("AdminDeleteConfirm in AdminStartHandler: ", error);
  }
};
const isSuperAdmin = (userId: any) => {
  return userId == config.SUPER_ADMIN_ID;
};
