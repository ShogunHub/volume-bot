import { bot } from "..";
import walletController from "../../controller/wallet";
import depositController from "../../controller/deposit";
import tokenController from "../../controller/tokenSetting";
import dotenv from "dotenv";
export let tokenDepositInfo = {} as any;
const { Connection, PublicKey } = require("@solana/web3.js");
import {config }from '../../../src/config'

const connection = new Connection(config.rpcUrl);
let validToken = "" as any;
dotenv.config();

export const depositHandler = async (msg: any) => {
	tokenDepositInfo = {};
	validToken = "";
	const user = await walletController.findOne({
		filter: {
			userId: msg.chat.id,
		},
	});
	if (user) {
		const user1 = await tokenController.findOne({
			filter: {
				userId: msg.chat.id,
			},
		});
		if (!user1) {
			bot.sendMessage(
				msg.chat.id,
				`
⚠️ <b>Please set up the token.</b> ⚠️`,
				{
					parse_mode: "HTML",
					reply_markup: {
						inline_keyboard: [
							[{ text: "Return 👈", callback_data: "return" }],
						],
					},
				}
			);
		} else {
			const data = user1.pairInfo;
			for (let i = 0; i < data.length; i++) {
				if (validToken.indexOf(data[i]?.inSymbol) < 0) {
					validToken += ` ${data[i]?.inSymbol}`;
				}
			}
			bot.sendMessage(
				msg.chat.id,
				`
Please deposit to the following address and send <i>txID</i> link.

<b>Valid token symbol: </b> ${validToken}   

<code>${user.publicKey}</code>`,
				{
					parse_mode: "HTML",
					reply_markup: {
						force_reply: true,
					},
				}
			).then((sentMessage) => {
				bot.onReplyToMessage(
					sentMessage.chat.id,
					sentMessage.message_id,
					async (reply) => {
						let txSignature = "";
						let txId = reply.text?.trim() as string;
						if ([
								"/cancel",
								"/support",
								"/start",
								"/wallet",
								"/token",
								"/deposit",
								"/balance",
								"/withdraw",
								"/activity",
								"/volume"
							].includes(txId)){
							return;
						}
						
						if (txId.indexOf("https://solscan.io/tx/") > -1) {
							txSignature = txId.split("/").pop() || "";
						} else {
							txSignature = txId;
						}
						// Fetch the parsed transaction using the tx signature
						const tx = await connection.getParsedTransaction(
							txSignature
						);
						if (!tx || !tx.meta || !tx.transaction) {
							await isValidtxSignature(msg, user.publicKey);
						} else {
							//Loop through the instructions to find the receiving address
							for (const instruction of tx.transaction.message
								.instructions) {
								if (
									instruction.programId.toString() ===
									"11111111111111111111111111111111"
								) {
									// Native SOL transfer
									const parsedInstruction = instruction.parsed as any;
									const receiverAddress = parsedInstruction.info.destination;
									if (user.publicKey === receiverAddress) {
										tokenDepositInfo = {
											tokenInfo: "So11111111111111111111111111111111111111112",
											userId: msg.chat.id,
										};
										bot.sendMessage(
											msg.chat.id,
											`
<b>Please check again.</b>
    
<code>${txSignature}</code>`,
											{
												parse_mode: "HTML",
												reply_markup: {
													inline_keyboard: [
														[
															{
																text: "Cancel ❌",
																callback_data: "return",
															},
															{
																text: "Ok ✔️",
																callback_data: "confirm_txSignature",
															},
														],
													],
												},
											}
										);
									} else {
										await isValidtxSignature(
											msg,
											user.publicKey
										);
									}
								} else if (
									instruction.programId.toString() === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
								) {
									const parsed = instruction.parsed;
									if ((parsed.type === "transfer" && parsed.info) ||
										(parsed.type === "transferChecked" && parsed.info)) {
										const receiverTokenAccount = parsed.info.destination;
										const accountInfo = await connection.getParsedAccountInfo(
												new PublicKey( receiverTokenAccount));
										if (accountInfo && accountInfo.value) {
											const receiverAddress = accountInfo.value.data.parsed.info.owner;
											const tokenAccount = instruction.parsed.info.mint;
											if (
												user.publicKey === receiverAddress
											) {
												tokenDepositInfo = {
													tokenInfo: tokenAccount,
													userId: msg.chat.id,
												};
												bot.sendMessage( msg.chat.id, `
<b>Please check again.</b>
    
${txSignature}`,
													{
														parse_mode: "HTML",
														reply_markup: {
															inline_keyboard: [
																[
																	{
																		text: "Cancel ❌",
																		callback_data:
																			"return",
																	},
																	{
																		text: "Ok ✔️",
																		callback_data:
																			"confirm_txSignature",
																	},
																],
															],
														},
													}
												);
											} else {
												await isValidtxSignature(
													msg,
													user.publicKey
												);
											}
										} else {
											await isValidtxSignature(
												msg,
												user.publicKey
											);
										}
									} else {
										await isValidtxSignature(
											msg,
											user.publicKey
										);
									}
								}
							}
						}
					}
				);
			});
		}
	} else {
		bot.sendMessage(msg.chat.id, `Please connect the wallet address.`, {
			parse_mode: "HTML",
			reply_markup: {
				inline_keyboard: [
					[{ text: "Cancel  👈", callback_data: "return" }],
				],
			},
		});
	}
};

export const confirm_txSignatureHandler = async (msg: any) => {
	const result = await depositController.create(tokenDepositInfo);
	if (result.status == 200) {
		bot.editMessageReplyMarkup(
			{ inline_keyboard: [] }, // Empty keyboard (remove previous one)
			{ chat_id: msg.chat.id, message_id: msg.message_id }
		);
		bot.sendMessage(msg.chat.id, result.message, {
			parse_mode: "HTML",
			reply_markup: {
				inline_keyboard: [
					[{ text: "Return  👈", callback_data: "return" }],
				],
			},
		});
	} else if (result.status == 201) {
		bot.editMessageReplyMarkup(
			{ inline_keyboard: [] }, // Empty keyboard (remove previous one)
			{ chat_id: msg.chat.id, message_id: msg.message_id }
		);
		bot.sendMessage(
			msg.chat.id,
			`Deposit failed. Please try again a later.`,
			{
				parse_mode: "HTML",
				reply_markup: {
					inline_keyboard: [
						[{ text: "Cancel  👈", callback_data: "return" }],
					],
				},
			}
		);
	} else if (result.status == 202) {
		bot.editMessageReplyMarkup(
			{ inline_keyboard: [] },
			{ chat_id: msg.chat.id, message_id: msg.message_id }
		);
		bot.sendMessage(msg.chat.id, result.message, {
			parse_mode: "HTML",
			reply_markup: {
				inline_keyboard: [
					[{ text: "Return  👈", callback_data: "return" }],
				],
			},
		});
	} else {
		bot.editMessageReplyMarkup(
			{ inline_keyboard: [] }, // Empty keyboard (remove previous one)
			{ chat_id: msg.chat.id, message_id: msg.message_id }
		);
		bot.sendMessage(
			msg.chat.id,
			`
Server has generated the error.
Please again later.`,
			{
				parse_mode: "HTML",
				reply_markup: {
					inline_keyboard: [
						[{ text: "Cancel  👈", callback_data: "return" }],
					],
				},
			}
		);
	}
};

const isValidtxSignature = (msg: any, publicKey: string) => {
	bot.sendMessage(msg.chat.id, `Please input valid <i>txID</i> link.`, {
		parse_mode: "HTML",
		reply_markup: {
			force_reply: true,
		},
	}).then((sentMessage) => {
		bot.onReplyToMessage(
			sentMessage.chat.id,
			sentMessage.message_id,
			async (reply) => {
				const txSignature = reply.text?.trim() as string;
				if (
					[
						"/cancel",
						"/support",
						"/start",
						"/wallet",
						"/token",
						"/deposit",
						"/balance",
						"/withdraw",
						"/acitivity",
						"/volume"
					].includes(txSignature)
				) {
					return;
				}
				// Fetch the parsed transaction using the tx signature
				const tx = await connection.getParsedTransaction(txSignature);
				if (!tx || !tx.meta || !tx.transaction) {
					await isValidtxSignature(msg, publicKey);
				}
				//Loop through the instructions to find the receiving address
				for (const instruction of tx.transaction.message.instructions) {
					if (
						instruction.programId.toString() ===
						"11111111111111111111111111111111"
					) {
						const parsedInstruction = instruction.parsed as any;
						const receiverAddress =
							parsedInstruction.info.destination;
						if (publicKey === receiverAddress) {
							tokenDepositInfo = {
								tokenInfo: "So11111111111111111111111111111111111111112",
								userId: msg.chat.id,
							};
							bot.sendMessage(
								msg.chat.id,
								`
<b>Please check again.</b>
${txSignature}`,
								{
									parse_mode: "HTML",
									reply_markup: {
										inline_keyboard: [
											[
												{
													text: "Cancel ❌",
													callback_data: "return",
												},
												{
													text: "Ok ✔️",
													callback_data: "confirm_txSignature",
												},
											],
										],
									},
								}
							);
						} else {
							await isValidtxSignature(msg, publicKey);
						}
					} else if (
						instruction.programId.toString() ===
						"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
					) {
						const parsed = instruction.parsed;
						if (
							(parsed.type === "transfer" && parsed.info) ||
							(parsed.type === "transferChecked" && parsed.info)
						) {
							const receiverTokenAccount = parsed.info.destination;

							const accountInfo = await connection.getParsedAccountInfo( new PublicKey(receiverTokenAccount));
							if (accountInfo && accountInfo.value) {
								const receiverAddress = accountInfo.value.data.parsed.info.owner;
								const tokenAccount = instruction.parsed.info.mint;
								if (publicKey === receiverAddress) {
									tokenDepositInfo = {
										tokenInfo: tokenAccount,
										userId: msg.chat.id,
									};
									bot.sendMessage(
										msg.chat.id,
										`
<b>Please check again.</b>

${txSignature}`,
										{
											parse_mode: "HTML",
											reply_markup: {
												inline_keyboard: [
													[
														{
															text: "Cancel ❌",
															callback_data:
																"return",
														},
														{
															text: "Ok ✔️",
															callback_data:
																"confirm_txSignature",
														},
													],
												],
											},
										}
									);
								} else {
									return isValidtxSignature(msg, publicKey);
								}
							} else {
								return isValidtxSignature(msg, publicKey);
							}
						} else {
							return isValidtxSignature(msg, publicKey);
						}
					}
				}
			}
		);
	});
};
