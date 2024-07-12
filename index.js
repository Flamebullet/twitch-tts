const say = require('say');
const tmi = require('tmi.js');
const fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

function questionPrompt(q) {
	return new Promise((resolve, reject) => {
		rl.question(q, (userInput) => {
			resolve(userInput);
		});
	});
}

let { user, password, reademotes, ignoreprefix, voice, speed } = require('./cred.js');
voice = voice == undefined ? null : voice;
speed = speed == undefined ? 1 : speed;

const client = new tmi.Client({
	options: { debug: false },
	connection: {
		reconnect: true,
		secure: true
	},
	identity: {
		username: user,
		password: password // https://twitchapps.com/tmi/
	},
	channels: []
});

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function removeCharactersByRanges(inputString, emotes) {
	let unsortedrange = Object.values(emotes)[0];
	let ranges = [];
	for (let index in unsortedrange) {
		const value = unsortedrange[index];
		ranges.push(value.split('-'));
	}
	// Sort ranges by end index in descending order
	const sortedRanges = ranges.sort((a, b) => b[1] - a[1]);

	// Remove substrings from inputString
	for (let [start, end] of sortedRanges) {
		end++;
		inputString = inputString.slice(0, start) + inputString.slice(end);
	}

	return inputString;
}

function tts(username, text) {
	return new Promise((resolve, reject) => {
		say.speak(`${username} said ${text}`, voice, speed, (err) => {
			if (err) {
				reject(console.error(err));
			}

			resolve(console.log(`${username}: ${text}`));
		});
	});
}

async function main() {
	// Create .env file for initialisation
	if (user == undefined || password == undefined) {
		let reply = await questionPrompt('USERNAME(Enter twitch username): ');
		user = reply;

		reply = await questionPrompt('\nPASSWORD(NOT YOUR TWITCH ACCOUNT PASSWORD! Get your password here https://twitchapps.com/tmi/): ');
		password = reply;

		reply = await questionPrompt('\nRead Emotes(1 for yes, 0 for no, recommended 0): ');
		if (reply != 0 || reply != 1) reply = 0;
		reademotes = reply;

		reply = await questionPrompt('\nIgnore Prefix(1 for yes, 0 for no, recommended 1): ');
		if (reply != 0 || reply != 1) reply = 1;
		ignoreprefix = reply;

		let voicesList;
		function getVoices() {
			return new Promise((resolve) => {
				say.getInstalledVoices((err, voice) => {
					return resolve(voice);
				});
			});
		}
		async function usingVoices() {
			voicesList = await getVoices();
			console.log(
				`\n\nList of available voices: ${voicesList} \nCheck out the following link to download more: https://support.microsoft.com/en-gb/topic/download-languages-and-voices-for-immersive-reader-read-mode-and-read-aloud-4c83a8d8-7486-42f7-8e46-2b0fdf753130`
			);
		}
		await usingVoices();
		reply = await questionPrompt('\nTTS Voice(Default is Microsoft David Desktop (Male) or Microsoft Zira Desktop (Female):');
		if (voicesList.indexOf(reply) === -1) reply = `Microsoft David Desktop`;
		voice = reply;

		reply = await questionPrompt('\nTTS Speed(recommended 1): ');
		if (reply != 0 || reply != 1) reply = 1;
		speed = reply;

		const content = `USERNAME=${user},
PASSWORD=${password}
READEMOTES=${reademotes}
IGNOREPREFIX=${ignoreprefix}
VOICE=${voice}
SPEED=${speed}`;
		const folderPath = process.env.USERPROFILE + '/twitch-tts';
		if (!fs.existsSync(folderPath)) {
			fs.mkdirSync(folderPath);
			console.log(`Folder "${folderPath}" created successfully.`);
		}
		const filePath = process.env.USERPROFILE + '/twitch-tts/.env'; // Specify the file path

		try {
			fs.writeFileSync(filePath, content);
			console.log('\n\n.env file created successfully!');
		} catch (err) {
			console.error('Error writing to file (synchronously):', err);
		}
	}

	await client.connect();
	await client.join(user);

	commandPrompt();

	let ttsQueue = [],
		currentlySpeaking = false;
	client.on('message', async (channel, tags, message, self) => {
		// ignore messages with prefix
		if (ignoreprefix && message.startsWith('!')) return;
		if (!reademotes && tags['emote-only']) return;
		let msg = message;
		if (!reademotes && tags.emotes) {
			msg = removeCharactersByRanges(msg, tags.emotes);
		}

		ttsQueue.push({ username: tags.username, message: msg });

		if (!currentlySpeaking) speak();
	});

	async function speak() {
		currentlySpeaking = true;
		while (ttsQueue.length > 0) {
			const ttsMsg = ttsQueue.shift();
			await tts(ttsMsg.username, ttsMsg.message);
			await sleep(500);
			if (ttsQueue.length == 0) currentlySpeaking = false;
		}
	}
}

main();

function commandPrompt() {
	rl.question('', function (reply) {
		if (reply == 's' || reply == 'skip') {
			say.stop();
		}
		commandPrompt();
	});
}
