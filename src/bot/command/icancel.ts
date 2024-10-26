

const { bot, Commands } = require("../index.ts");
const { removeAnswerCallback, sendMessage } = require('../library/index');
export default new Commands(
    new RegExp(/^\/cancel/),
    "Cancel Bot",
    "cancel",
    true,
    async (msg: any) => {
        removeAnswerCallback(msg.chat)
        await sendMessage(msg.chat.id, `<b>All active commands have been canceled.</b>`)
    }
)